import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class ClearCommand extends BaseCommand {
	name = "clear";
	description = "Clear upcoming videos from the queue";
	usage = "clear";
	aliases = ["clearqueue", "cq"];

	async execute(context: CommandContext): Promise<void> {
		const queueService = context.streamingService.getQueueService();
		const removedCount = queueService.clearUpcoming();

		await this.sendInfo(
			context.message,
			"Queue",
			removedCount > 0
				? `Cleared ${removedCount} upcoming video${removedCount === 1 ? '' : 's'}.`
				: 'The queue was already empty.'
		);
	}
}