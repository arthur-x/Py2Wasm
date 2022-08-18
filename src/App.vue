<script>
import * as CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/dracula.css'
import 'codemirror/mode/python/python.js'
import 'codemirror/mode/wast/wast.js'
import {compile, run} from './compiler'

export default {
  data() {
    return {
      result: ''
    }
  },
  mounted() {
    this.py = CodeMirror.fromTextArea(document.getElementById('python-code'), {
      lineNumbers: true,
      theme: 'dracula',
      mode: 'python'
    })
    this.wasm = CodeMirror.fromTextArea(document.getElementById('wasm-code'), {
      lineNumbers: true,
      theme: 'dracula',
      mode: 'wast'
    })
    let init = 
    `class FibonacciCalculator(object):\r  def calculate(self : FibonacciCalculator, x : int) -> int:\r    if x == 1 or x == 2:\r      return 1\r    return self.calculate(x - 1) + self.calculate(x - 2)\r\rfc : FibonacciCalculator = None\rfc = FibonacciCalculator()\rprint(fc.calculate(42))`
    this.py.setValue(init)
  },
  methods: {
    display(arg) {
      this.result += arg + '\n'
    },
    async runButton() {
      const memory = new WebAssembly.Memory({initial:10, maximum:100})
      const importObject = {
        imports: {
          print_num: (arg) => {
            this.display(String(arg))
            return arg
          },
          print_bool: (arg) => {
            if (arg === 0) this.display("False")
            else this.display("True")
            return arg
          },
          print_none: (arg) => {
            this.display("None")
            return arg
          },
          abs : Math.abs, 
          min: Math.min,
          max: Math.max,
          pow: Math.pow,
          mem: memory
        }
      } 
      this.result = ''
      try {
        const wat = compile(this.py.getValue())
        this.wasm.setValue(wat)
        await run(wat, {importObject})
      }
      catch(e) { 
        this.display(String(e))
      }
    }
  }
}
</script>

<template>
<main style="display: grid; grid-template-columns: 50% 50%; grid-gap: 10px;">
  <div style="display: flex; flex-direction: column;">
    <textarea id="python-code"></textarea>
    <button style="margin-top: 10px;" @click="runButton">Compile & Run</button>
  </div>
  <div style="display: flex; flex-direction: column;">
    <textarea id="wasm-code"></textarea>
    <textarea style="margin-top: 10px" rows="5" readonly id="result" v-model="result"></textarea>
  </div>
</main>
</template>

<style scoped>
textarea {
  font-size: 1em;
  font-weight: 500;
  resize: none;
  border: 1px solid transparent;
  border-radius: 10px;
}

button {
  height: 100px;
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: background-color 0.25s;
}
button:hover {
  background-color: #646cff;
}
</style>
