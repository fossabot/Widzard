#!/usr/bin/env node
const meow = require('meow');
const chalk = require('chalk');

const pkg = require('./../package.json');
const main = require('./main.js');

const cli = meow(
	`
		Version: ${chalk.yellow(pkg.version)}
		Notes: Please supply either a --webpack or --stats argv.
		Options:
		  ${chalk.yellow('--help')}
			- description: Show the help text.
			- alias: -h
			- default: false
			- type: boolean

		  ${chalk.yellow('--clear')}
			- description: Clear the console.
			- alias: -c
			- default: false
			- type: boolean

		  ${chalk.yellow('--webpack')}
			- description: The path to your webpack config file.
			- alias: -w
			- type: string

		  ${chalk.yellow('--stats')}
			- description: For if you already have a stats.json.
			- alias: -s
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

		  ${chalk.yellow('--cyclical')}
			- description: Highlight cyclical dependencies.
			- alias: -cyc
			- default: true
			- type: boolean

		  ${chalk.yellow('--dir-clustering')}
			- description: Cluster modules by parent directory.
			- alias: -dirC
			- default: false
			- type: boolean

		  ${chalk.yellow('--dir-clustering-nested')}
			- description: Created hierarchical clusters of module directories.
			- alias: -dirCN
			- default: false
			- type: boolean
	`,
	{
		flags: {
			help: {
				type: 'boolean',
				alias: 'h',
				default: false,
			},
			clear: {
				type: 'boolean',
				alias: 'c',
				default: false,
			},
			webpack: {
				type: 'string',
				alias: 'w',
			},
			stats: {
				type: 'string',
				alias: 's',
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
			cyclical: {
				type: 'boolean',
				alias: 'cyc',
				default: true,
			},
			dirClustering: {
				type: 'boolean',
				alias: 'dirC',
				default: false,
			},
			dirClusteringNested: {
				type: 'boolean',
				alias: 'dirCN',
				default: false,
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

main(cli.flags);
