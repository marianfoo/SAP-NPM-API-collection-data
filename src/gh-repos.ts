/* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment *
// import { Octokit } from "@octokit/core";
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
const MyOctokit = Octokit.plugin(throttling);
import * as jsdoc2md from "jsdoc-to-markdown";
import * as yaml from "js-yaml";
import { exec } from "shelljs";
import { readFileSync, writeFileSync } from "fs";
import { BoUI5Types, IPackage, Jsdoc, JsdocType, Params, Source, SubPackage, UI5Yaml } from "./types";
import Package from "./Package";

export default class GitHubRepositoriesProvider {
	static source = "github-packages";

	static octokit = new MyOctokit({
		auth: process.env.GITHUB_TOKEN,
		throttle: {
			onRateLimit: (retryAfter: any, options: any) => {
				GitHubRepositoriesProvider.octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

				// Retry four times after hitting a rate limit error, then give up
				if (options.request.retryCount <= 4) {
					console.log(`Retrying after ${retryAfter} seconds!`);
					return true;
				}
			},
			onAbuseLimit: (retryAfter: any, options: any) => {
				// does not retry, only logs a warning
				GitHubRepositoriesProvider.octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
			},
		},
	});

	static async get(): Promise<IPackage[]> {
		const packages: IPackage[] = [];
		exec(`git clone https://github.com/gregorwolf/SAP-NPM-API-collection`);
		// base repo
		const source: Source = {
			subpath: "apis",
			path: "",
			owner: "gregorwolf",
			repo: "SAP-NPM-API-collection",
			addedToBoUI5: "",
			type: BoUI5Types.module,
			tags: [],
			subpackages: [],
		};
		try {
			const data = await GitHubRepositoriesProvider.octokit.rest.repos.getContent({
				mediaType: {
					format: "raw",
				},
				owner: "gregorwolf",
				repo: "SAP-NPM-API-collection",
				path: `apis`,
			});
			const array = data.data as Array<any>;
			// filter objects from array with name starting with cloud-sdk-op-vdm cloud-sdk-op-vdm-
			const filteredArray = array.filter((obj) => !obj.name.startsWith("cloud-sdk-op-vdm") && !obj.name.startsWith("cloud-sdk-vdm") && obj.name !== ".DS_Store");
			// testing only x folders
			const slicedArray = filteredArray.slice(0, 20);

			for (const obj of slicedArray) {
				const subpackage: SubPackage = {
					name: obj.name,
					addedToBoUI5: "",
					type: BoUI5Types.module,
					tags: [],
				};
				source.subpackages.push(subpackage);
			}

			const repoInfo = await this.getRepoInfo(source);
			for (const subpackage of source.subpackages) {
				const path = `${source.subpath}/${subpackage.name}/`;
				console.log(`Reading Data from ${source.owner}/${source.repo}/${source.subpath}/${subpackage.name}/`);
				const packageInfo = this.fetchRepo(source, path, repoInfo, subpackage);
				packages.push(packageInfo);
			}
		} catch (error) {
			console.log(`Error while reading GitHub Data from ${source.owner}/${source.repo}/${source.subpath}`);
			console.log(error);
		}

		return packages;
	}

	static async getRepoInfo(source: Source): Promise<IPackage> {
		const packageObject: IPackage = new Package();
		const repo = await GitHubRepositoriesProvider.octokit.rest.repos.get({
			owner: source.owner,
			repo: source.repo,
		});
		packageObject.createdAt = repo.data.created_at;
		packageObject.updatedAt = repo.data.updated_at;

		packageObject.githublink = repo.data.html_url;
		packageObject.forks = repo.data.forks;
		packageObject.stars = repo.data.stargazers_count;
		return packageObject;
	}

	static fetchRepo(source: Source, path: string, repoInfo: Package, sourcePackage: SubPackage): IPackage {
		const packageReturn: IPackage = new Package();
		try {
			packageReturn.name = sourcePackage.name;
			packageReturn.type = sourcePackage.type;
			packageReturn.gitHubOwner = source.owner;
			packageReturn.gitHubRepo = source.repo;
			packageReturn.license = repoInfo.license;
			packageReturn.forks = repoInfo.forks;
			packageReturn.stars = repoInfo.stars;
			packageReturn.addedToBoUI5 = sourcePackage.addedToBoUI5;
			packageReturn.createdAt = repoInfo.createdAt;
			packageReturn.updatedAt = repoInfo.updatedAt;

			try {
				packageReturn.readme = readFileSync(`${__dirname}/../SAP-NPM-API-collection/apis/${sourcePackage.name}/README.md`).toString();
			} catch (error) {
				console.log(`No README.md found for ${source.owner}/${source.repo}/${path}`);
			}
			try {
				packageReturn.changelog = readFileSync(`${__dirname}/../SAP-NPM-API-collection/apis/${sourcePackage.name}/CHANGELOG.md`).toString();
			} catch (error) {
				console.log(`No CHANGELOG.md found for ${source.owner}/${source.repo}/${path}`);
			}
		} catch (error) {
			console.log(`Error while reading GitHub Data from ${source.owner}/${source.repo}/${source.subpath}`);
			console.log(error);
		}

		return packageReturn;
	}
}
