import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class CurrentCommand extends BaseCommand {
	name = "current";
	description = "Display the complete title of the currently playing video";
	usage = "current";

	async execute(context: CommandContext): Promise<void> {
		const queueService = context.streamingService.getQueueService();
		const currentItem = queueService.getCurrent();
		const queueStatus = queueService.getQueueStatus();

		if (!queueStatus.isPlaying || !currentItem) {
			await this.sendInfo(context.message, 'Currently Playing', 'Nothing is currently playing.');
			return;
		}

		await this.sendInfo(context.message, 'Currently Playing', currentItem.title);
	}
}