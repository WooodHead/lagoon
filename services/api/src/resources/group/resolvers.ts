import * as R from 'ramda';
import validator from 'validator';
import { isPatchEmpty } from '../../util/db';
import * as projectHelpers from '../project/helpers';

export const addGroup = async (_root, { input }, { dataSources }) => {
  if (validator.matches(input.name, /[^0-9a-z-]/)) {
    throw new Error(
      'Only lowercase characters, numbers and dashes allowed for name!',
    );
  }

  let parentGroupId: string;
  if (R.has('parentGroup', input)) {
    if (R.isEmpty(input.parentGroup)) {
      throw new Error('You must provide a group id or name');
    }

    const parentGroup = await dataSources.GroupModel.loadGroupByIdOrName(input.parentGroup);
    parentGroupId = parentGroup.id;
  }


  const user = await dataSources.GroupModel.addGroup({
    id: input.id,
    name: input.name,
    parentGroupId,
  });

  return user;
};

export const updateGroup = async (
  _root,
  { input: { id, patch } },
  { credentials: { role, userId }, dataSources },
) => {
  if (role !== 'admin' && !R.equals(userId, id)) {
    throw new Error('Unauthorized.');
  }

  if (isPatchEmpty({ patch })) {
    throw new Error('Input patch requires at least 1 attribute');
  }

  if (typeof patch.name === 'string') {
    if (validator.matches(patch.name, /[^0-9a-z-]/)) {
      throw new Error(
        'Only lowercase characters, numbers and dashes allowed for name!',
      );
    }
  }

  const group = await dataSources.GroupModel.updateGroup({
    id,
    name: patch.name,
  });

  return group;
};

export const deleteGroup = async (
  _root,
  { input: { id } },
  { credentials: { role, userId }, dataSources },
) => {
  if (role !== 'admin' && !R.equals(userId, id)) {
    throw new Error('Unauthorized.');
  }

  await dataSources.GroupModel.deleteGroup(id);

  return 'success';
};

export const deleteAllGroups = async (
  _root,
  _args,
  { credentials: { role }, dataSources },
) => {
  if (role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const groups = await dataSources.GroupModel.loadAllGroups();
  const groupIds = R.pluck('id', groups);

  const deleteGroups = groupIds.map(
    async id => await dataSources.GroupModel.deleteGroup(id),
  );

  try {
    // Deleting all groups in parallel may cause problems, but this is only used
    // in the tests right now and the number of users for that use case is low.
    await Promise.all(deleteGroups);
  } catch (err) {
    throw new Error(`Could not delete all groups: ${err.message}`);
  }

  return 'success';
};

export const addUserToGroup = async (
  _root,
  { input: { user: userInput, group: groupInput, role } },
  { dataSources },
) => {
  if (R.isEmpty(userInput)) {
    throw new Error('You must provide a user id or email');
  }

  const user = await dataSources.UserModel.loadUserByIdOrUsername({
    id: R.prop('id', userInput),
    username: R.prop('email', userInput),
  });

  if (R.isEmpty(groupInput)) {
    throw new Error('You must provide a group id or name');
  }

  const group = await dataSources.GroupModel.loadGroupByIdOrName(groupInput);

  await dataSources.GroupModel.removeUserFromGroup(user, group);
  const updatedGroup = await dataSources.GroupModel.addUserToGroup(
    user,
    group,
    role,
  );

  return updatedGroup;
};

export const removeUserFromGroup = async (
  _root,
  { input: { user: userInput, group: groupInput } },
  { dataSources },
) => {
  if (R.isEmpty(userInput)) {
    throw new Error('You must provide a user id or email');
  }

  const user = await dataSources.UserModel.loadUserByIdOrUsername({
    id: R.prop('id', userInput),
    username: R.prop('email', userInput),
  });

  if (R.isEmpty(groupInput)) {
    throw new Error('You must provide a group id or name');
  }

  const group = await dataSources.GroupModel.loadGroupByIdOrName(groupInput);

  const updatedGroup = await dataSources.GroupModel.removeUserFromGroup(
    user,
    group,
  );

  return updatedGroup;
};

export const addGroupsToProject = async (
  _root,
  { input: { project: projectInput, groups: groupsInput } },
  { dataSources, sqlClient },
) => {
  const project = await projectHelpers(sqlClient).getProjectByProjectInput(
    projectInput,
  );

  if (R.isEmpty(groupsInput)) {
    throw new Error('You must provide groups');
  }

  const groupsInputNotEmpty = R.filter(R.complement(R.isEmpty), groupsInput);

  if (R.isEmpty(groupsInputNotEmpty)) {
    throw new Error('One or more of your groups is missing an id or name');
  }

  for (const groupInput of groupsInput) {
    const group = await dataSources.GroupModel.loadGroupByIdOrName(groupInput);
    await dataSources.GroupModel.addProjectToGroup(project.id, group);
  }

  return await projectHelpers(sqlClient).getProjectById(project.id);
};

export const removeGroupsFromProject = async (
  _root,
  { input: { project: projectInput, groups: groupsInput } },
  { dataSources, sqlClient },
) => {
  const project = await projectHelpers(sqlClient).getProjectByProjectInput(
    projectInput,
  );

  if (R.isEmpty(groupsInput)) {
    throw new Error('You must provide groups');
  }

  const groupsInputNotEmpty = R.filter(R.complement(R.isEmpty), groupsInput);

  if (R.isEmpty(groupsInputNotEmpty)) {
    throw new Error('One or more of your groups is missing an id or name');
  }

  for (const groupInput of groupsInput) {
    const group = await dataSources.GroupModel.loadGroupByIdOrName(groupInput);
    await dataSources.GroupModel.removeProjectFromGroup(project.id, group);
  }

  return await projectHelpers(sqlClient).getProjectById(project.id);
};