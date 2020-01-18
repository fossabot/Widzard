#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const meow = require('meow');
const chalk = require('chalk');
const mkdirp = require('mkdirp');
const slash = require('slash');

const pkg = require('./../package.json');
const main = require('./main.js');

const cli = meow(
	`
		Version: ${chalk.yellow(pkg.version)}
		Options:
		  ${chalk.yellow('--help')}
			- description: show the help text.
			- alias: -h
			- default: false
			- type: boolean

		  ${chalk.yellow('--webpack')}
			- description: The path to your webpack config file.
			- alias: -w
			- type: string

		  ${chalk.yellow('--dir')}
			- description: An output directory.
			- alias: -d
			- default: './'
			- type: string

		  ${chalk.yellow('--name')}
			- description: The filename for the outputted file.
			- alias: -n
			- default: 'widzard.svg'
			- type: string

		  ${chalk.yellow('--target')}
			- description: The target path relative to the webpack config.
			- alias: -t
			- default: './src/index.js'
			- type: string

		  ${chalk.yellow('--clear')}
			- description: Clear the console.
			- alias: -c
			- default: false
			- type: boolean

		  ${chalk.yellow('--cyclical')}
			- description: Highlight cyclical dependencies.
			- alias: -cyc
			- default: true
			- type: boolean
	`,
	{
		flags: {
			help: {
				type: 'boolean',
				alias: 'h',
				default: false,
			},
			webpack: {
				type: 'string',
				alias: 'w',
			},
			dir: {
				type: 'string',
				alias: 'd',
				default: './',
			},
			name: {
				type: 'string',
				alias: 'n',
				default: 'widzard.svg',
			},
			target: {
				type: 'string',
				alias: 't',
				default: './src/index.js',
			},
			clear: {
				type: 'boolean',
				alias: 'c',
				default: false,
			},
			cyclical: {
				type: 'boolean',
				alias: 'cyc',
				default: true,
			},
		},
	},
);

process.on('uncaughtException', (err) => {
	console.error(err);
	process.exit(1); // eslint-disable-line no-process-exit
});

if (cli.flags.clear) console.log('\u001b[2J\u001b[0;0H');
if (cli.flags.help) console.log(cli.help);
if (typeof cli.flags.webpack === 'undefined')
	throw new Error('No webpack path supplied.');

const cwd = process.cwd();

const webpackConfigPath = path.join(cwd, cli.flags.webpack);
const webpackConfig = require(webpackConfigPath); // eslint-disable-line security/detect-non-literal-require
webpackConfig.devServer = undefined;

const outputDir = path.join(cwd, cli.flags.dir);
if (!fs.existsSync(outputDir)) mkdirp.sync(outputDir); // eslint-disable-line security/detect-non-literal-fs-filename
const outputPath = path.join(outputDir, cli.flags.name);

try {
	const targetPath = path.resolve(cwd, cli.flags.target);
	const targetFullPath = require.resolve(targetPath);
	const targetModule = '.' + targetFullPath.replace(cwd, '');
	cli.flags.target = slash(targetModule);
} catch (e) {
	throw new Error(`Unable to find target: ${cli.flags.target}`);
}

main({
	webpackConfig,
	target: cli.flags.target,
	cyclicalRefs: cli.flags.cyclical,
	outputDir,
	output: outputPath,
});
