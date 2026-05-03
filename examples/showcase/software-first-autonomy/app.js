const storyResponse = await fetch('./story.json');
const story = await storyResponse.json();

const state = {
  activeProjectId: 'project-demo-content-artifact-loop',
};

const projectButtons = [...document.querySelectorAll('[data-project-id]')];
const projectType = document.querySelector('[data-testid="project-type"]');
const projectName = document.querySelector('[data-testid="project-name"]');
const projectStatus = document.querySelector('[data-testid="project-status"]');
const projectClaim = document.querySelector('[data-testid="project-claim"]');
const approvalTitle = document.querySelector('[data-testid="approval-title"]');
const exceptionSummary = document.querySelector('[data-testid="exception-summary"]');
const decisionNote = document.querySelector('[data-testid="decision-note"]');
const policySummary = document.querySelector('[data-testid="policy-summary"]');
const allowedActions = document.querySelector('[data-testid="allowed-actions"]');
const blockedActions = document.querySelector('[data-testid="blocked-actions"]');
const evidenceCount = document.querySelector('[data-testid="evidence-count"]');
const evidenceList = document.querySelector('[data-testid="evidence-list"]');
const interventionCopy = document.querySelector('[data-testid="intervention-copy"]');

function activeProject() {
  return (
    story.projects.find((project) => project.id === state.activeProjectId) ?? story.projects[0]
  );
}

function renderList(container, items) {
  container.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }),
  );
}

function renderEvidence(projectId) {
  const entries = story.evidence.filter((entry) => entry.projectId === projectId);
  evidenceList.replaceChildren(
    ...entries.map((entry) => {
      const row = document.createElement('article');
      row.className = 'evidence-entry';

      const title = document.createElement('strong');
      title.textContent = `${entry.id} - ${entry.kind}`;

      const summary = document.createElement('p');
      summary.textContent = entry.summary;

      const hash = document.createElement('span');
      hash.textContent = entry.hash;

      row.append(title, summary, hash);
      return row;
    }),
  );
}

function render() {
  const project = activeProject();

  for (const button of projectButtons) {
    button.classList.toggle('project-button--active', button.dataset.projectId === project.id);
  }

  projectType.textContent = project.type;
  projectName.textContent = project.name;
  projectStatus.textContent = project.status;
  projectClaim.textContent = project.claim;
  approvalTitle.textContent = project.pendingApproval;
  exceptionSummary.textContent = project.exception;
  policySummary.textContent = project.policy;
  evidenceCount.textContent = `${project.evidenceCount} entries`;
  interventionCopy.textContent = story.intervention.note;

  renderList(allowedActions, project.allowedActions);
  renderList(blockedActions, project.blockedActions);
  renderEvidence(project.id);
}

for (const button of projectButtons) {
  button.addEventListener('click', () => {
    state.activeProjectId = button.dataset.projectId;
    decisionNote.textContent =
      'Project context switched. Review policy and evidence before action.';
    render();
  });
}

document.querySelector('[data-testid="approve-with-exception"]').addEventListener('click', () => {
  decisionNote.textContent =
    'Approved with exception. Evidence Log records the weak citation boundary.';
});

document.querySelector('[data-testid="request-changes"]').addEventListener('click', () => {
  decisionNote.textContent =
    'Changes requested. The Run remains paused until the exception is remediated.';
});

document.querySelector('[data-testid="record-intervention"]').addEventListener('click', () => {
  decisionNote.textContent =
    'Intervention recorded. Autonomy is scoped to QA evidence and rollback notes.';
});

render();
