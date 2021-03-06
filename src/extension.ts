import * as vscode from "vscode";

const TASK_CONFIG_KEY = "auto-task.scheduledTaskConfigurations";
const SCHEDULE_TASK_COMMAND = "extension.auto-task.scheduleTask";
const CANCEL_TASK_COMMAND = "extension.auto-task.cancelTask";

export function activate(context: vscode.ExtensionContext) {
  const scheduledTasks: { [index: string]: ScheduledTask } = {};

  let scheduleTask = vscode.commands.registerCommand(SCHEDULE_TASK_COMMAND, async () => {
    const configuredTasks = getConfiguredTasks();

    // there should be a description that shows the source
    // option should be disabled or maybe not appear if a task is already running
    const selectedTaskName = await vscode.window.showQuickPick(configuredTasks.map(t => t.name));
    if (!selectedTaskName) {
      return;
    }

    const configuredTask = configuredTasks.find(t => t.name === selectedTaskName)!;

    let vscodeTask = (await vscode.tasks.fetchTasks()).find(t => t.name === configuredTask.name);

    if (!vscodeTask) {
      vscode.window.showErrorMessage("Couldn't start the task " + configuredTask.name + " :(");
      return;
    }

    const recurTime = parseTime(configuredTask.timeframe);

    // TODO: make this smarter. It probably even deserves its own class to manage running tasks
    let currentTaskExecution: vscode.TaskExecution;

    try {
      currentTaskExecution = await vscode.tasks.executeTask(vscodeTask);
    } catch {
      vscode.window.showInformationMessage(`Couldn't start ${configuredTask.name} as a scheduled task`);
      return;
    }

    scheduledTasks[configuredTask.name] = {
      ...configuredTask,
      taskExecution: currentTaskExecution,
      interval: setInterval(async () => {
        if (!vscode.tasks.taskExecutions.includes(scheduledTasks[configuredTask.name].taskExecution)) {
          const nextTaskExecution = await vscode.tasks.executeTask(vscodeTask!);
          scheduledTasks[configuredTask.name].taskExecution = nextTaskExecution;
          vscode.window.showInformationMessage(configuredTask.name + " executing again :)");
        } else {
          vscode.window.showWarningMessage(configuredTask.name + " is still executing");
        }
      }, recurTime)
    };
  });

  let cancelTask = vscode.commands.registerCommand(CANCEL_TASK_COMMAND, async () => {
    const configuredTasks = getConfiguredTasks();

    // TODO: there should be an information message like "No tasks have been scheduled"
    const taskSelections = configuredTasks.filter(({ name }) => !!scheduledTasks[name]).map(t => t.name);
    const selectedTaskName = await vscode.window.showQuickPick(taskSelections);
    if (!selectedTaskName) {
      return;
    }

    clearInterval(scheduledTasks[selectedTaskName].interval);
    delete scheduledTasks[selectedTaskName];
    vscode.window.showInformationMessage(`Scheduled task for ${selectedTaskName} has been cancelled`);
  });

  context.subscriptions.push(scheduleTask);
  context.subscriptions.push(cancelTask);
}

export function deactivate() {}

interface ConfiguredTask {
  name: string;
  timeframe: string;
  onlyIfChanged?: boolean;
}

interface ScheduledTask extends ConfiguredTask {
  taskExecution: vscode.TaskExecution;
  interval: NodeJS.Timeout;
}

function parseTime(timeframe: string): number {
  const matchResult = timeframe.match(/(\d\d):(\d\d):(\d\d)/);

  if (!matchResult || matchResult.length !== 4) {
    throw new Error("The timeframe " + timeframe + " does not meet the hh:mm:ss format");
  }

  const secondInMs = 1000;
  const minuteInMs = secondInMs * 60;
  const hourInMs = minuteInMs * 60;

  return (
    parseInt(matchResult[1])! * hourInMs +
    parseInt(matchResult[2])! * minuteInMs +
    parseInt(matchResult[3])! * secondInMs
  );
}

function getConfiguredTasks(): ConfiguredTask[] {
  return vscode.workspace.getConfiguration().get(TASK_CONFIG_KEY) as ConfiguredTask[];
}
