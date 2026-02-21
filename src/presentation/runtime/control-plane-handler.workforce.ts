/**
 * Workforce and human-task HTTP handlers for the control-plane runtime.
 */

export {
  handleGetWorkforceMember,
  handleListWorkforceMembers,
  handleListWorkforceQueues,
  handlePatchWorkforceAvailability,
} from './control-plane-handler.workforce-members.js';

export {
  handleAssignHumanTask,
  handleCompleteHumanTask,
  handleEscalateHumanTask,
  handleGetHumanTask,
  handleListEvidence,
  handleListHumanTasks,
} from './control-plane-handler.human-tasks.js';
