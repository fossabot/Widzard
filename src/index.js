#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rc = require('rc')('widzard', {
	baseDir: null,
	excludeRegExp: false,
	fileExtensions: ['js'],
	includeNpm: false,
	rankdir: 'LR',
	layout: 'dot',
	fontName: 'Arial',
	fontSize: '14px',
	backgroundColor: '#111111',
	nodeColor: '#c6c5fe',
	nodeShape: 'box',
	nodeStyle: 'rounded',
	noDependencyColor: '#cfffac',
	cyclicNodeColor: '#ff6c60',
	edgeColor: '#757575',
	graphVizOptions: false,
	graphVizPath: false,
	graphOutputType: 'svg',
});
const graphviz = require('graphviz');
const meow = require('meow');
const chalk = require('chalk');
const ora = require('ora');
const mkdirp = require('mkdirp');
const slash = require('slash');
const webpack = require('webpack');

const pkg = require('./../package.json');
const tarjan = require('./tarjan');

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

JSON.pretty = (msg, fn = null, indent = 2) => JSON.stringify(msg, fn, indent);
console.json = (msg, fn, indent) => console.log(JSON.pretty(msg, fn, indent));

/**
 * Set color on a node.
 * @param  {Object} node
 * @param  {String} color
 */
function setNodeColor(node, color) {
	node.set('color', color);
	node.set('fontcolor', color);
}

/**
 * Creates the graphviz graph.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {Object} config
 * @param  {Object} options
 * @return {Promise}
 */
function createGraph(modules, circular, GVConfig, options) {
	const g = graphviz.digraph('G');
	const nodes = {};
	const cyclicModules = [];
	for (const cyclicRefs of circular) {
		cyclicModules.concat(cyclicRefs);
	}

	if (GVConfig.graphVizPath) {
		g.setGraphVizPath(GVConfig.graphVizPath);
	}

	for (const id of Object.keys(modules)) {
		nodes[String(id)] = nodes[String(id)] || g.addNode(id);

		if (!modules[String(id)].length) {
			setNodeColor(nodes[String(id)], GVConfig.noDependencyColor);
		} else if (cyclicModules.indexOf(id) >= 0) {
			setNodeColor(nodes[String(id)], GVConfig.cyclicNodeColor);
		}

		for (const depId of modules[String(id)]) {
			nodes[String(depId)] = nodes[String(depId)] || g.addNode(depId);

			if (!modules[String(depId)]) {
				setNodeColor(nodes[String(depId)], GVConfig.noDependencyColor);
			}

			g.addEdge(nodes[String(id)], nodes[String(depId)]);
		}
	}
	return new Promise(function(resolve, reject) {
		g.output(options, resolve, function(code, out, err) {
			reject(new Error(err));
		});
	});
}
function findDescendants(data, target) {
	if (!data[String(target)]) {
		fs.writeFileSync(
			path.join(outputDir, 'wizard.data.json'),
			JSON.pretty(data),
		);
		throw new Error(`Unable to find target: ${target}`);
	}
	const result = {};

	function lookup(t) {
		if (result[String(t)]) return;
		const v = data[String(t)];
		result[String(t)] = v;
		v.forEach(lookup);
	}

	lookup(target);
	return result;
}

(async function() {
	const { modules: webpackModules } = await new Promise(function(resolve) {
		webpack(webpackConfig, function(err, stats) {
			// Stats Object
			if (err) {
				throw new Error(err);
			} else if (stats.hasErrors()) {
				throw new Error('stats has errors');
			} else if (typeof stats === 'undefined') {
				throw new Error('stats is undefined');
			}
			resolve(stats.toJson());
		});
	});
	console.log('\n');
	const spinner = ora({
		spinner: {
			interval: 400,
			frames: ['(╯°Д°）╯彡 ┻━┻', "(╯'Oﾟ）╯︵ ┳━┳"],
		},
		prefixText: '-',
		text: 'Starting',
	}).start();
	process.once('SIGINT', function() {
		spinner.warn('(ಠ_ಠ) CTRL-C (ಠ_ಠ)\n');
	});
	try {
		const modules = Object.values(webpackModules)
			.filter(({ id }) => !String(id).includes('node_modules'))
			// .map(({ id, reasons }) => ({ [String(id)]: reasons }))
			.reduce(function(acc, { id, reasons }) {
				reasons.forEach(function({ moduleId }) {
					const source = moduleId !== null ? moduleId : 'webpack';
					if (!acc[String(source)]) acc[String(source)] = [];
					if (!acc[String(id)]) acc[String(id)] = [];
					if (!acc[String(source)].includes(String(id)))
						acc[String(source)].push(String(id));
				});
				return acc;
			}, {});

		const targetModules = cli.flags.target
			? findDescendants(modules, cli.flags.target)
			: modules;
		const cyclical = cli.flags.cyclical ? tarjan(targetModules) : [];
		const graphVizOptions = rc.graphVizOptions || {};

		const options = {
			// Graph
			G: {
				...graphVizOptions.G,
				overlap: false,
				pad: 0.3,
				rankdir: rc.rankdir,
				layout: rc.layout,
				bgcolor: rc.backgroundColor,
			},
			// Edge
			E: {
				...graphVizOptions.E,
				color: rc.edgeColor,
			},
			// Node
			N: {
				...graphVizOptions.N,
				fontname: rc.fontName,
				fontsize: rc.fontSize,
				color: rc.nodeColor,
				shape: rc.nodeShape,
				style: rc.nodeStyle,
				height: 0,
				fontcolor: rc.nodeColor,
			},
			type: rc.graphOutputType,
		};
		spinner.text = 'Creating Graph';
		const output = await createGraph(targetModules, cyclical, rc, options);
		spinner.text = 'Writing output';
		fs.writeFileSync(outputPath, output); // eslint-disable-line security/detect-non-literal-fs-filename
		spinner.succeed(`Output: ${outputPath}`);
	} catch (e) {
		spinner.fail();
		throw new Error(e);
	}
	console.log('\n');
})();
