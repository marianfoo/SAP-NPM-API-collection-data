/* eslint-disable @typescript-eslint/no-floating-promises */
// require("dotenv").config();
import { readFileSync, writeFileSync } from "fs";

import GitHubRepositoriesProvider from "./gh-repos";
import NPMProvider from "./npm";
import { IPackage, Tags, DataJson } from "./types";

// TEST

(async () => {
	const dataJson: DataJson = {
		packages: [],
		tags: [],
	};

	let githubPackages: IPackage[] = await GitHubRepositoriesProvider.get();
	githubPackages = await NPMProvider.get(githubPackages);

	dataJson.packages = githubPackages;

	writeFileSync(`${__dirname}/../data/data.json`, JSON.stringify(dataJson));
})();
