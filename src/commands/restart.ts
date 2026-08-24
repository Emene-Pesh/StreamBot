import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class RestartCommand extends BaseCommand {
	name = "restart";
	description = "Restart the currently playing video";
	usage = "restart";

	async execute(context: CommandContext): Promise<void> {
		await context.streamingService.restartCurrent(context.message);
	}
}