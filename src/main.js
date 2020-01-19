const fs = require('fs');
const path = require('path');

const rc = require('rc')('widzard', {
	includeNpm: false,
	noDependencyColor: '#ffd700',
	cyclicNodeColor: '#ff628c',
	graphVizPath: false,
	graphVisOptions: {
		G: {
			overlap: false,
			pad: 1,
			rankdir: 'LR',
			layout: 'dot',
			bgcolor: '#1e1e3f',
		},
		E: {
			color: '#a599e9',
		},
		N: {
			fontname: 'Arial',
			fontsize: '14px',
			color: '#9effff',
			shape: 'box',
			style: 'rounded',
			height: 0,
			fontcolor: '#9effff',
		},
		type: 'svg',
	},
});
const graphviz = require('graphviz');
const ora = require('ora');
const webpack = require('webpack');
const slash = require('slash');
const mkdirp = require('mkdirp');

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

function getDir(path, delimiter = '/') {
	const delimiterPosition = path.lastIndexOf(delimiter);
	return path.substring(0, delimiterPosition);
}

/**
 * Creates the graphviz graph.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {Object} config
 * @param  {Object} options
 * @param  {Boolean} dirClustering
 * @return {Promise}
 */
function createGraph(modules, circular, config, options, dirClustering) {
	const g = graphviz.digraph('G');
	const nodes = {};
	const clusters = {};
	const clusterIds = {};
	const cyclicModules = circular.flat();

	if (config.graphVizPath) {
		g.setGraphVizPath(config.graphVizPath);
	}

	for (const id of Object.keys(modules)) {
		const dir = getDir(id);

		if (dirClustering && typeof clusterIds[String(dir)] === 'undefined') {
			const id = `cluster${g.clusterCount()}`;
			clusterIds[String(dir)] = id;
			clusters[String(id)] = g.addCluster(String(id));
			clusters[String(id)].set('tooltip', dir);
			clusters[String(id)].set('bgcolor', '#2d2b55');
			clusters[String(id)].set('color', '#393939');
		}

		if (typeof nodes[String(id)] === 'undefined') {
			const graph = dirClustering ? clusters[clusterIds[String(dir)]] : g;
			nodes[String(id)] = graph.addNode(id);
		}

		if (!modules[String(id)].length) {
			setNodeColor(nodes[String(id)], config.noDependencyColor);
		} else if (cyclicModules.indexOf(id) >= 0) {
			setNodeColor(nodes[String(id)], config.cyclicNodeColor);
		}

		for (const depId of modules[String(id)]) {
			const depDir = getDir(depId);

			if (dirClustering && typeof clusterIds[String(depDir)] === 'undefined') {
				const id = `cluster${g.clusterCount()}`;
				clusterIds[String(depDir)] = id;
				clusters[String(id)] = g.addCluster(String(id));
				clusters[String(id)].set('tooltip', depDir);
				clusters[String(id)].set('bgcolor', '#2d2b55');
				clusters[String(id)].set('color', '#393939');
			}

			if (typeof nodes[String(depId)] === 'undefined') {
				const graph = dirClustering ? clusters[clusterIds[String(depDir)]] : g;
				nodes[String(depId)] = graph.addNode(depId);
			}

			if (typeof modules[String(depId)] === 'undefined') {
				setNodeColor(nodes[String(depId)], config.noDependencyColor);
			}

			const targetGraph =
				dirClustering && dir === depDir
					? clusters[clusterIds[String(depDir)]]
					: g;
			targetGraph.addEdge(nodes[String(id)], nodes[String(depId)]);
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

async function getModules(webpackPath, statsPath) {
	if (typeof webpackPath !== 'undefined') {
		const absolutePath = path.join(process.cwd(), webpackPath);
		const webpackConfig = require(absolutePath); // eslint-disable-line security/detect-non-literal-require
		webpackConfig.devServer = undefined;
		const data = await new Promise(function(resolve) {
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
		fs.writeFileSync('./stats.json', JSON.stringify(data, null, 2));
		const { modules } = data;
		if (typeof modules === 'undefined')
			throw new Error(`Unable to retrieve modules via: ${webpackConfig}`);
		return modules;
	}

	if (typeof statsPath !== 'undefined') {
		const absolutePath = path.join(process.cwd(), statsPath);
		const { modules } = require(absolutePath); // eslint-disable-line security/detect-non-literal-require
		if (typeof modules === 'undefined')
			throw new Error(`Unable to retrieve modules via: ${statsPath}`);
		return modules;
	}

	throw new Error('No valid input, either --webpack or --stats is required.');
}

function parseTarget(target) {
	try {
		const targetPath = path.resolve(process.cwd(), target);
		const targetFullPath = require.resolve(targetPath);
		const targetModule = '.' + targetFullPath.substring(process.cwd().length);
		return slash(targetModule);
	} catch (e) {
		throw new Error(`Unable to find target: ${target}`);
	}
}

module.exports = async function({
	webpack: webpackPath,
	stats: statsPath,
	dir,
	name,
	target,
	cyclical,
	dirClustering,
}) {
	const webpackModules = await getModules(webpackPath, statsPath);
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
				rc.includeNpm
					? () => true
					: ({ id }) => !String(id).includes('node_modules'),
			)
			.reduce(function(acc, { id, reasons }) {
				if (!acc[String(id)]) acc[String(id)] = [];
				for (const { moduleId } of reasons) {
					const source = moduleId !== null ? moduleId : 'webpack';
					if (!acc[String(source)]) acc[String(source)] = [];
					if (!acc[String(source)].includes(String(id)))
						acc[String(source)].push(String(id));
				}
				return acc;
			}, {});

		const outputDir = path.join(process.cwd(), dir);
		if (!fs.existsSync(outputDir)) mkdirp.sync(outputDir); // eslint-disable-line security/detect-non-literal-fs-filename
		const targetModules = target
			? findDescendants(modules, parseTarget(target), outputDir)
			: modules;
		const cyclicalRelationships = cyclical ? tarjan(targetModules) : [];

		spinner.text = 'Creating Graph';
		const data = await createGraph(
			targetModules,
			cyclicalRelationships,
			{
				noDependencyColor: rc.noDependencyColor,
				cyclicNodeColor: rc.cyclicNodeColor,
				graphVizPath: rc.graphVizPath,
			},
			rc.graphVisOptions,
			dirClustering,
		);
		spinner.text = 'Writing output';
		const outputPath = path.join(outputDir, name);
		fs.writeFileSync(outputPath, data); // eslint-disable-line security/detect-non-literal-fs-filename
		spinner.succeed(`Output: ${outputPath}`);
	} catch (exception) {
		spinner.fail();
		throw exception;
	}
	console.log('\n');
};
