<p align="center">
	<img alt="Widzards are cool" src="https://media.giphy.com/media/TcdpZwYDPlWXC/giphy.gif" height="200">
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/widzard" target="_blank">
    	<img alt="Last version" src="https://img.shields.io/github/package-json/v/jonathonhawkins92/widzard?style=flat-square" />
    </a>
    <a href="https://david-dm.org/jonathonhawkins92/widzard" target="_blank">
    	<img alt="Dependency status" src="http://img.shields.io/david/jonathonhawkins92/widzard.svg?style=flat-square" />
    </a>
    <a href="https://david-dm.org/jonathonhawkins92/widzard#info=devDependencies" target="_blank">
    	<img alg="Dev Dependencies status" src="http://img.shields.io/david/dev/jonathonhawkins92/widzard.svg?style=flat-square" />
    </a>
    <a href="https://www.npmjs.org/package/widzard" target="_blank">
    	<img alg="NPM Status" src="http://img.shields.io/npm/dm/widzard.svg?style=flat-square" />
    </a>

</p>

# 🧙‍♂️ Widzard

Think [Madge](https://www.npmjs.com/package/madge) mixed with [Webpack](https://webpack.js.org/) and you've got the idea.

I got bored one day and decided I wanted to make a graph from my webpack builds output, this is that, enjoy!

```
$ npm i -d widzard
```

```
$ yarn add -d widzard
```

<img alt="Example graph" src="https://raw.githubusercontent.com/jonathonhawkins92/Widzard/master/example.png" height="320"/>

## 📈 Graphviz

> [Graphviz](http://www.graphviz.org/) is currently required, though I'm hoping to change this via the use of [Dagre](https://github.com/dagrejs/dagre).

## CLI

*--help*
 - description: show the help text.
 - alias: -h
 - default: false
 - type: boolean

*--clear*
 - description: Clear the console.
 - alias: -c
 - default: false
 - type: boolean

*--webpack*
 - description: The path to your webpack config file.
 - alias: -w
 - type: string

*--stats*
 - description: For if you already have a stats.json.
 - alias: -s
 - type: string

*--dir*
 - description: An output directory.
 - alias: -d
 - default: './'
 - type: string

*--name*
 - description: The filename for the outputted file.
 - alias: -n
 - default: 'widzard.svg'
 - type: string

*--target*
 - description: The target path relative to the webpack config.
 - alias: -t
 - default: './src/index.js'
 - type: string

*--cyclical*
 - description: Highlight cyclical dependencies.
 - alias: -cyc
 - default: true
 - type: boolean

## 🛠 Development

- `npm i` install all the things.
- `npm i -g` to install Widzard globally.
- `widzard -h` to make sure everything is set up correctly.
