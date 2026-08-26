import { BaseCommand } from "./base.js";
import { CommandContext, QueueItem } from "../types/index.js";

export default class QueueCommand extends BaseCommand {
	name = "queue";
	description = "Display the current video queue";
	usage = "queue";

	async execute(context: CommandContext): Promise<void> {
		const queueItems = context.streamingService.getQueueService().getQueue();
		const currentItem = context.streamingService.getQueueService().getCurrent();
		const queueStatus = context.streamingService.getQueueService().getQueueStatus();

		if (queueItems.length === 0) {
			await this.sendInfo(context.message, 'Queue', 'The queue is currently empty.');
			return;
		}

		let queueText = `📋 **Queue** (${queueItems.length} item${queueItems.length !== 1 ? 's' : ''})\n\n`;

		if (queueStatus.isPlaying && currentItem) {
			const status = currentItem.resolved ? '▶️' : '⏳';
			const title = currentItem.resolved ? currentItem.title : `${currentItem.title} (resolving...)`;
			queueText += `${status} **Currently Playing:**\n\`${title}\` (requested by ${currentItem.requestedBy})\n\n`;
		}

		queueText += '**Up Next:**\n';

		// Show all items that are not currently playing
		const upcomingItems = queueItems.filter(item => !queueStatus.isPlaying || item.id !== currentItem?.id);

		if (upcomingItems.length === 0) {
			if (queueStatus.isPlaying && currentItem) {
				queueText += '*No upcoming items*\n';
			} else {
				queueText += '*Queue is empty*\n';
			}
		} else {
			const groupedItems = this.groupByShow(upcomingItems);
			groupedItems.forEach((group, index) => {
				const position = queueStatus.isPlaying ? index + 1 : index;
				if (group.items.length > 1) {
					queueText += `${position + 1}. \`${group.title}\` (${group.items.length} episodes)\n`;
					return;
				}

				const item = group.items[0];
				const addedTime = item.addedAt.toLocaleTimeString();
				const status = item.resolved ? '' : '⏳';
				const title = item.resolved ? item.title : `${item.title} (pending)`;
				queueText += `${position + 1}. ${status} \`${title}\` (by ${item.requestedBy}) - Added at ${addedTime}\n`;
			});
		}

		// Discord limits individual messages, so split only at complete lines.
		let messagePart = '';
		for (const line of queueText.split('\n')) {
			const nextPart = messagePart ? `${messagePart}\n${line}` : line;
			if (nextPart.length > 1900 && messagePart) {
				await context.message.channel.send(messagePart);
				messagePart = line;
			} else {
				messagePart = nextPart;
			}
		}
		if (messagePart) {
			await context.message.channel.send(messagePart);
		}
	}

	private groupByShow(items: QueueItem[]): Array<{ title: string; items: QueueItem[] }> {
		const groups = new Map<string, { title: string; items: QueueItem[] }>();

		for (const item of items) {
			const showTitle = this.getShowTitle(item.title);
			const key = showTitle.toLowerCase();
			const group = groups.get(key);
			if (group) {
				group.items.push(item);
			} else {
				groups.set(key, { title: showTitle, items: [item] });
			}
		}

		return Array.from(groups.values());
	}

	private getShowTitle(title: string): string {
		const episodeMarker = /\s*(?:[-|:]\s*)?(?:s\d{1,2}\s*e\d{1,2}(?:\s*[-&,/]\s*e?\d{1,2})?|\d{1,2}x\d{1,2}|season\s+\d+(?:\s*episode\s*\d+)?|episode\s*\d+|ep\.?\s*\d+)\b.*$/i;
		const showTitle = title.replace(episodeMarker, '').trim().replace(/[\s|:-]+$/, '').trim();
		return showTitle || title;
	}
}