import { BaseCommand } from "./base.js";
import { CommandContext } from "../types/index.js";
import { MediaService } from "../services/media.js";
import { ErrorUtils, GeneralUtils } from '../utils/shared.js';
import fs from 'fs';
import path from 'path';
import config from "../config.js";

export default class PlayCommand extends BaseCommand {
	name = "play";
	description = "Play local video, URL, or search YouTube videos";
	usage = "play <video_name|url|search_query>";

	private mediaService: MediaService;

	constructor() {
		super();
		this.mediaService = new MediaService();
	}

	async execute(context: CommandContext): Promise<void> {
		const input = context.args.join(' ');

		if (!input) {
			await this.sendError(context.message, 'Please provide a video name, URL, or search query.');
			return;
		}

		if (input.toLowerCase() === '24/7 tv') {
			await this.handleLocalVideoLoop(context);
			return;
		}

		// Check if input is a URL (YouTube, Twitch, or direct link)
		if (GeneralUtils.isValidUrl(input)) {
			await this.handleUrl(context, input);
		} else {
			// Refresh video list from disk before matching
			const videoFiles = fs.readdirSync(config.videosDir);
			const refreshedVideos = videoFiles.map(file => ({
				name: path.parse(file).name,
				path: path.join(config.videosDir, file)
			}));
			context.videos.length = 0;
			context.videos.push(...refreshedVideos);

			// Case-insensitive match
			const video = context.videos.find(m => m.name.toLowerCase() === input.toLowerCase());

			if (video) {
				await this.handleLocalVideo(context, video);
			} else {
				// Treat as search query
				await this.handleSearchQuery(context, input);
			}
		}
	}

	private async handleLocalVideoLoop(context: CommandContext): Promise<void> {
		const videoFiles = fs.readdirSync(config.videosDir, { withFileTypes: true })
			.filter(entry => entry.isFile())
			.map(entry => ({
				name: path.parse(entry.name).name,
				path: path.join(config.videosDir, entry.name)
			}));

		context.videos.length = 0;
		context.videos.push(...videoFiles);

		if (videoFiles.length === 0) {
			await this.sendError(context.message, 'No local videos found.');
			return;
		}

		const queueService = context.streamingService.getQueueService();
		queueService.setLooping(true);
		for (const video of this.createTvSchedule(videoFiles)) {
			await context.streamingService.addToQueue(context.message, video.path, video.name);
		}

		if (!context.streamStatus.playing) {
			await context.streamingService.playFromQueue(context.message);
		}
	}

	private createTvSchedule(videoFiles: Array<{ name: string; path: string }>): Array<{ name: string; path: string }> {
		const shows = new Map<string, Array<{ name: string; path: string; season: number; episode: number }>>();

		for (const video of videoFiles) {
			const episodeMatch = video.name.match(/\bS(\d{1,2})E(\d{1,3})/i);
			const showName = episodeMatch
				? video.name.slice(0, episodeMatch.index).replace(/[\s|:-]+$/, '').trim()
				: video.name;
			const key = showName.toLowerCase();
			const showEpisodes = shows.get(key) || [];
			showEpisodes.push({
				...video,
				season: episodeMatch ? Number(episodeMatch[1]) : Number.MAX_SAFE_INTEGER,
				episode: episodeMatch ? Number(episodeMatch[2]) : Number.MAX_SAFE_INTEGER
			});
			shows.set(key, showEpisodes);
		}

		const remainingShows = Array.from(shows.values());
		for (const episodes of remainingShows) {
			episodes.sort((first, second) =>
				first.season - second.season ||
				first.episode - second.episode ||
				first.name.localeCompare(second.name)
			);
		}

		const schedule: Array<{ name: string; path: string }> = [];
		let previousShow: Array<{ name: string; path: string; season: number; episode: number }> | null = null;
		let consecutiveCount = 0;

		while (remainingShows.length > 0) {
			const eligibleShows = remainingShows.filter(show => show !== previousShow || consecutiveCount < 2);
			const candidates = eligibleShows.length > 0 ? eligibleShows : remainingShows;
			const selectedIndex = Math.floor(Math.random() * candidates.length);
			const selectedShow = candidates[selectedIndex];
			const nextEpisode = selectedShow.shift();
			if (!nextEpisode) {
				remainingShows.splice(remainingShows.indexOf(selectedShow), 1);
				continue;
			}

			schedule.push({ name: nextEpisode.name, path: nextEpisode.path });
			if (selectedShow === previousShow) {
				consecutiveCount++;
			} else {
				previousShow = selectedShow;
				consecutiveCount = 1;
			}

			if (selectedShow.length === 0) {
				remainingShows.splice(remainingShows.indexOf(selectedShow), 1);
			}
		}

		return schedule;
	}


	private async handleLocalVideo(context: CommandContext, video: any): Promise<void> {
		// Add to queue instead of playing immediately
		const success = await context.streamingService.addToQueue(context.message, video.path, video.name);

		if (success) {
			// If not currently playing, start playing from queue
			if (!context.streamStatus.playing) {
				await context.streamingService.playFromQueue(context.message);
			}
		}
	}

	private async handleUrl(context: CommandContext, url: string): Promise<void> {
		try {
			// For lazy processing, just add to queue - resolution happens when playing
			const success = await context.streamingService.addToQueue(context.message, url);

			if (success) {
				// If not currently playing, start playing from queue
				if (!context.streamStatus.playing) {
					await context.streamingService.playFromQueue(context.message);
				}
			}
		} catch (error) {
			await ErrorUtils.handleError(error, `processing URL: ${url}`, context.message);
		}
	}

	private async handleSearchQuery(context: CommandContext, query: string): Promise<void> {
		try {
			// For lazy processing, add the search query to queue
			// The actual search and resolution will happen when it's time to play
			const success = await context.streamingService.addToQueue(context.message, query, `Search: ${query}`);

			if (success) {
				// If not currently playing, start playing from queue
				if (!context.streamStatus.playing) {
					await context.streamingService.playFromQueue(context.message);
				}
			}
		} catch (error) {
			await ErrorUtils.handleError(error, 'adding search query to queue', context.message);
		}
	}
}