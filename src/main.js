const fs = require('fs');
const path = require('path');

const rc = require('rc')('widzard', {
	includeNpm: false,
	noDependencyColor: '#cfffac',
	cyclicNodeColor: '#ff6c60',
	graphVizPath: false,
	G: {
		rankdir: 'LR',
		layout: 'dot',
		backgroundColor: '#111111',
		overlap: false,
		pad: 0.3,
	},
	E: {
		edgeColor: '#757575',
	},
	N: {
		fontName: 'Arial',
		fontSize: '14px',
		nodeColor: '#c6c5fe',
		nodeShape: 'box',
		nodeStyle: 'rounded',
		height: 0,
		fontcolor: '#c6c5fe',
	},
	graphOutputType: 'svg',
});
const graphviz = require('graphviz');
const ora = require('ora');
const webpack = require('webpack');

const tarjan = require('./tarjan');

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
function createGraph(modules, circular, config, options) {
	const g = graphviz.digraph('G');
	const nodes = {};
	const cyclicModules = [];
	for (const cyclicRefs of circular) {
		cyclicModules.concat(cyclicRefs);
	}

	if (config.graphVizPath) {
		g.setGraphVizPath(config.graphVizPath);
	}

	for (const id of Object.keys(modules)) {
		nodes[String(id)] = nodes[String(id)] || g.addNode(id);

		if (!modules[String(id)].length) {
			setNodeColor(nodes[String(id)], config.noDependencyColor);
		} else if (cyclicModules.indexOf(id) >= 0) {
			setNodeColor(nodes[String(id)], config.cyclicNodeColor);
		}

		for (const depId of modules[String(id)]) {
			nodes[String(depId)] = nodes[String(depId)] || g.addNode(depId);

			if (!modules[String(depId)]) {
				setNodeColor(nodes[String(depId)], config.noDependencyColor);
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

function findDescendants(data, target, outputDir) {
	if (!data[String(target)]) {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
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

module.exports = async function({
	webpackConfig,
	target,
	cyclicalRefs,
	outputDir,
	output,
}) {
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
			.filter(
				({ id }) => !rc.includeNpm && !String(id).includes('node_modules'),
			)
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

		const targetModules = target
			? findDescendants(modules, target, outputDir)
			: modules;
		const cyclical = cyclicalRefs ? tarjan(targetModules) : [];

		spinner.text = 'Creating Graph';
		const data = await createGraph(
			targetModules,
			cyclical,
			{
				graphVizPath: rc.graphVizPath,
				noDependencyColor: rc.noDependencyColor,
				cyclicNodeColor: rc.cyclicNodeColor,
			},
			{
				// Graph
				G: rc.G,
				// Edge
				E: rc.E,
				// Node
				N: rc.N,
				type: rc.graphOutputType,
			},
		);
		spinner.text = 'Writing output';
		fs.writeFileSync(output, data); // eslint-disable-line security/detect-non-literal-fs-filename
		spinner.succeed(`Output: ${output}`);
	} catch (e) {
		spinner.fail();
		throw new Error(e);
	}
	console.log('\n');
};
