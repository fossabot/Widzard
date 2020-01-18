'use strict';

// https://www.youtube.com/watch?v=TyWtx7q2D7Y&t=402s
// initial source: https://github.com/dagrejs/graphlib/blob/master/lib/alg/tarjan.js
function tarjan(nodes) {
	let index = 0;
	const stack = [];
	const visited = {}; // node id -> { onStack, lowlink, index }
	const results = [];

	function dfs(v) {
		const entry = (visited[v] = {
			onStack: true,
			lowlink: index,
			index: index++
		});
		stack.push(v);

		nodes[v].forEach(function(w) {
			if (!visited[w]) {
				dfs(w);
				entry.lowlink = Math.min(entry.lowlink, visited[w].lowlink);
			} else if (visited[w].onStack) {
				entry.lowlink = Math.min(entry.lowlink, visited[w].index);
			}
		});

		if (entry.lowlink === entry.index) {
			const cmpt = [];
			let w;
			do {
				w = stack.pop();
				visited[w].onStack = false;
				cmpt.push(w);
			} while (v !== w);
			results.push(cmpt);
		}
	}

	Object.keys(nodes).forEach(function(v) {
		if (!visited[v] && nodes[v]) {
			dfs(v);
		}
	});

	return results;
}

module.exports = function(data, acyclical = false) {
	const result = tarjan(data);
	if (acyclical) {
		return result;
	}
	return result.filter(function(x) {
		return x.length > 1 || (x.length && data[x[0]].length === 1 && x[0] === data[x[0]][0]);
	});
};
