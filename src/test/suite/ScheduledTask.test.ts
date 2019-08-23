import "should";

import ScheduledTask, { ITaskConfiguration } from "../../ScheduledTask";

const createMockConfiguration = (): ITaskConfiguration => ({
  name: "MyTask",
  timeframe: "00:00:30"
});

suite("ScheduledTask", () => {
  test("has the correct name", async () => {
    // arrange
    const config = createMockConfiguration();

    // act
    const task = await ScheduledTask.create(config);

    // assert
    task.name.should.be.exactly("MyTask");
  });

  suite("isScheduled", () => {
    test("returns true when an interval is set");
    test("returns false when an interval is not set");
  });
});
