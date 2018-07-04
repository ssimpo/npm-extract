#!/usr/bin/env node
'use strict';

const xExtractGitType = /^(gitlab|bitbucket|github|gist)\:/;
const xExtractGitDir = /^.*\//;
const xGitSsh = /git\+ssh\:\/\/.*?\@/;

const { spawn } = require('child_process');
const git = require('isomorphic-git');
const path = require('path');
const fs = require('fs');
const {get} = require('./lib/util');
const argv = require('yargs')
	.option('cwd', {
		alias: 'c',
		default: process.cwd(),
		describe: 'The working directory to extract and link from.',
		defaultDescription: 'Current working directory.',
		type: 'string'
	})
	.option('dest', {
		alias: 'd',
		describe: 'The directory to clone module to.',
		demandOption: 'No --dest switch given. Please supply a destination for module extraction.',
		type: 'string'
	})
	.option('id', {
		alias: 'i',
		describe: 'The module to clone and link.',
		demandOption: 'No --id switch given. Please supply a module to clone and link to.',
		type: 'string'
	})
	.option('pkfile', {
		alias: 'p',
		describe: 'The name of the package description file to extract data from.',
		default: 'package.json',
		type: 'string'
	})
	.option('dir', {
		alias: 'g',
		describe: 'The directory to clone to within destination directory.',
		defaultDescription: 'The repository name.',
		type: 'string'
	})
	.option('repo', {
		alias: 'r',
		describe: 'The url of the repository.',
		defaultDescription: 'Taken from the package file repository.url / repository.',
		type: 'string'
	})
	.option('npm', {
		alias: 'n',
		describe: 'The "npm" command to use, eg: npm, yarn or pnpm .',
		default: 'npm',
		type: 'string'
	})
	.argv;


const cwdRequire = require('require-like')(argv.cwd);
argv.repo = argv.repo || getGitRepository(argv);
argv.dir = argv.dir || argv.repo.replace(xExtractGitDir,'').replace('.git','');

run(argv);


async function run(argv) {
	try {
		await clone(argv);
		await npmInstall(argv);
		await npmLink(argv);
		await npmLinkBack(argv);
	} catch(err) {
		console.log('error -a');
		console.error(err);
	}
}

function npmInstall({dir, dest, npm}) {
	console.log(`Installing using ${npm} in ${path.join(dest, dir)}`);
	return new Promise((resolve, reject)=>{
		const install = spawn(npm, ['install'], {
			cwd: path.join(dest, dir)
		});
		install.stdout.on('data', data=>console.log(data.toString()));
		install.stderr.on('data', err=>console.error(err.toString()));
		install.on('close', code=>{
			if (code === 0) return resolve();
			return reject(new Error(`Abnormal exit from ${npm} with code ${code}.`))
		});
	});
}

function npmLink({dir, dest, npm}) {
	console.log(`Linking using ${npm} in ${path.join(dest, dir)}`);
	return new Promise((resolve, reject)=>{
		const link = spawn(npm, ['link'], {
			cwd: path.join(dest, dir)
		});
		link.stdout.on('data', data=>console.log(data.toString()));
		link.stderr.on('data', err=>console.error(err.toString()));
		link.on('close', code=>{
			if (code === 0) return resolve();
			return reject(new Error(`Abnormal exit from ${npm} link with code ${code}.`))
		});
	});
}

function npmLinkBack({dir, dest, npm, id, cwd}) {
	console.log(`Linking ${id} directory: ${path.join(dest, dir)}`);
	return new Promise((resolve, reject)=>{
		const link = spawn(npm, ['link', id], {cwd});
		link.stdout.on('data', data=>console.log(data.toString()));
		link.stderr.on('data', err=>console.error(err.toString()));
		link.on('close', code=>{
			if (code === 0) return resolve();
			return reject(new Error(`Abnormal exit from ${npm} link "${id}" with code ${code}.`))
		});
	});
}

async function clone({dest, repo:url, dir}) {
	console.log(`Cloning: ${url} into: ${path.join(dest, dir)}`);
	try {
		await git.clone({
			fs, dir:path.join(dest, dir), url
		});
	} catch(err) {
		console.error(err);
	}
}

function getPackageData({cwd, id, pkfile}) {
	const packagePath = path.join(cwd, 'node_modules', id, pkfile);
	try {
		return cwdRequire(packagePath);
	} catch (err) {
		throw new Error(`Could not load package file: ${packagePath} using root search path of: ${cwd}`);
	}
}

function convertShortRepoPaths(repoPath) {
	if (xExtractGitType.test(repoPath)) {
		const [fullMatch, repoStore] = xExtractGitType.exec(repoPath);
		repoPath = repoPath.replace(xExtractGitType,'');
		if (repoStore === 'gist') return `https://gist.${repoStore}.com/${repoPath}.git`;
		return `https://${repoStore}.${(repoStore==='bitbucket')?'org':'com'}/${repoPath}.git`;
	}
	if (xGitSsh.test(repoPath)) repoPath = 'https://' + repoPath.replace(xGitSsh, '').replace(':',`/`);

	return repoPath;
}

function getGitRepository({cwd, id, pkfile}) {
	const packageData = getPackageData({cwd, id, pkfile});
	let [repoType, repoPath] = [get(packageData, 'repository.type'), get(packageData, 'repository.url')];

	if (!repoPath && !repoType) {
		repoPath = packageData.repository;
		if (!repoPath) throw new AssertionError('Could not extract a usable repository address.');
	} else if (repoType !== 'git') {
		throw new TypeError(`Cannot extract from repository type ${repoType}`);
	}

	return convertShortRepoPaths(repoPath);
}