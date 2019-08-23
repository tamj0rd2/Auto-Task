import * as vscode from "vscode";

type TaskExecutionResponse = string;
type TaskExecutionCb = (message: string) => void;

export interface ITaskConfiguration {
  name: string;
  timeframe: string;
  onlyIfChanged?: boolean;
  disableFocus?: boolean;
  disableInformationMessages?: boolean;
  autoStart?: boolean;
}

export default class ScheduledTask {
  public static create = async (taskConfiguration: ITaskConfiguration): Promise<ScheduledTask> => {
    return new Promise((resolve, reject) => {
      vscode.tasks.fetchTasks().then(tasks => {
        const vscodeTask = tasks.find(t => t.name === taskConfiguration.name);
        return vscodeTask ? resolve(new ScheduledTask(taskConfiguration, vscodeTask)) : reject();
      });
    });
  };

  private intervalMs: number;
  private interval: NodeJS.Timeout | undefined;
  private currentExecution: vscode.TaskExecution | undefined;

  private constructor(
    private readonly taskConfiguration: ITaskConfiguration,
    private readonly vscodeTask: vscode.Task
  ) {
    this.intervalMs = parseTime(taskConfiguration.timeframe);
  }

  public get name(): string {
    return this.taskConfiguration.name;
  }

  public startSchedule = (): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        this.executeTask();
      } catch (e) {
        return reject(`Could not execute or schedule the task: ${this.name}`);
      }

      this.interval = setInterval(this.executeTask, this.intervalMs);
      resolve();
    });
  };

  public cancelSchedule = (): void => {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    } else {
      throw new Error("NO_RUNNING_SCHEDULE");
    }
  };

  private executeTask = async () => {
    if (!this.currentExecution || !vscode.tasks.taskExecutions.includes(this.currentExecution)) {
      this.currentExecution = await vscode.tasks.executeTask(this.vscodeTask);
      this.output(`Executing task "${this.name}"`);
    } else {
      this.output(`The previous execution of the task "${this.name}" is still running`);
    }
  };
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
    parseInt(matchResult[1], 10)! * hourInMs +
    parseInt(matchResult[2], 10)! * minuteInMs +
    parseInt(matchResult[3], 10)! * secondInMs
  );
}
