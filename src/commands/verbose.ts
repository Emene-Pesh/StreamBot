import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";

export default class VerboseCommand extends BaseCommand {
	name = "verbose";
	description = "Toggle messages when a new video starts playing";
	usage = "verbose";

	async execute(context: CommandContext): Promise<void> {
		context.streamStatus.verbose = !context.streamStatus.verbose;
		const state = context.streamStatus.verbose ? "enabled" : "disabled";

		await this.sendInfo(context.message, "Verbose playback", `Now ${state}.`);
	}
}