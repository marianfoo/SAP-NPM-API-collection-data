/* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment *
// import { Octokit } from "@octokit/core";
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
const MyOctokit = Octokit.plugin(throttling);
import * as jsdoc2md from "jsdoc-to-markdown";
import * as yaml from "js-yaml";

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
			const slicedArray = filteredArray.slice(0, 30);

			for (const obj of filteredArray) {
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
				console.log(`Fetching GitHub Data from ${source.owner}/${source.repo}/${source.subpath}/${subpackage.name}/`);
				const packageInfo = await this.fetchRepo(source, path, repoInfo, subpackage);
				packages.push(packageInfo);
			}
		} catch (error) {
			console.log(`1Error while fetching GitHub Data from ${source.owner}/${source.repo}/${source.subpath}`);
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
		// generator don´t have a npm module, get updatedat from last commit
		if (source.type === "generator") {
			try {
				packageObject.updatedAt = await this.getLastCommitDate(source, repo.data.default_branch);
			} catch (error) {
				console.log(error);
				console.log(`Error while fetching last commit date for ${source.path}`);
				packageObject.updatedAt = repo.data.updated_at;
			}
		} else {
			packageObject.updatedAt = repo.data.updated_at;
		}

		packageObject.githublink = repo.data.html_url;
		packageObject.forks = repo.data.forks;
		packageObject.stars = repo.data.stargazers_count;
		// packageObject.license = repo.data.license.key;
		// packageObject.defaultBranch = repo.data.default_branch;
		return packageObject;
	}

	static async fetchRepo(source: Source, path: string, repoInfo: Package, sourcePackage: SubPackage): Promise<IPackage> {
		let packageReturn: IPackage = new Package();
		try {
			// const data = await GitHubRepositoriesProvider.octokit.rest.repos.getContent({
			// 	mediaType: {
			// 		format: "raw",
			// 	},
			// 	owner: source.owner,
			// 	repo: source.repo,
			// 	path: `${path}package.json`,
			// });
			// const string = data.data.toString();
			// packageReturn = JSON.parse(string) as Package;
			packageReturn.name = sourcePackage.name;
			packageReturn.type = sourcePackage.type;
			// packageReturn.tags = sourcePackage.tags;
			packageReturn.gitHubOwner = source.owner;
			packageReturn.gitHubRepo = source.repo;
			packageReturn.license = repoInfo.license;
			packageReturn.forks = repoInfo.forks;
			packageReturn.stars = repoInfo.stars;
			packageReturn.addedToBoUI5 = sourcePackage.addedToBoUI5;
			packageReturn.createdAt = repoInfo.createdAt;
			packageReturn.updatedAt = repoInfo.updatedAt;

			// packageReturn.githublink = `${repoInfo.githublink}/tree/main/${path}`;
			try {
				const readme = await GitHubRepositoriesProvider.octokit.rest.repos.getContent({
					mediaType: {
						format: "raw",
					},
					owner: source.owner,
					repo: source.repo,
					path: `${path}README.md`,
				});
				const readmeString = readme.data.toString();
				packageReturn.readme = readmeString;
			} catch (error) {
				console.log(`No README.md found for ${source.owner}/${source.repo}/${path}`);
			}
			try {
				const readme = await GitHubRepositoriesProvider.octokit.rest.repos.getContent({
					mediaType: {
						format: "raw",
					},
					owner: source.owner,
					repo: source.repo,
					path: `${path}CHANGELOG.md`,
				});
				const readmeString = readme.data.toString();
				packageReturn.changelog = readmeString;
			} catch (error) {
				console.log(`No CHANGELOG.md found for ${source.owner}/${source.repo}/${path}`);
			}
		} catch (error) {
			console.log(`2Error while fetching GitHub Data from ${source.owner}/${source.repo}/${source.subpath}`);
			console.log(error);
		}

		return packageReturn;
	}

	static async getLastCommitDate(source: Source, defaultBranch: string): Promise<string> {
		const defaultBranchReference = await GitHubRepositoriesProvider.octokit.rest.git.getRef({
			owner: source.owner,
			repo: source.repo,
			ref: `heads/${defaultBranch}`,
		});
		const latestCommit = await GitHubRepositoriesProvider.octokit.rest.git.getCommit({
			owner: source.owner,
			repo: source.repo,
			commit_sha: defaultBranchReference.data.object.sha,
		});

		return latestCommit.data.committer.date;
	}
}
