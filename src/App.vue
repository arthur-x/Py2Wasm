<script>
import * as CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/dracula.css'
import 'codemirror/mode/python/python.js'
import 'codemirror/mode/wast/wast.js'

export default {
  data() {
    return {
      worker: new Worker(new URL('./worker.ts', import.meta.url), {type:'module'}),
      result: '',
      working: false,
      error: false
    }
  },
  mounted() {
    this.py = CodeMirror.fromTextArea(document.getElementById('python-code'), {
      lineNumbers: true,
      theme: 'dracula',
      mode: 'python',
      scrollbarStyle: 'null',
      lineWrapping: true,
    })
    this.wasm = CodeMirror.fromTextArea(document.getElementById('wasm-code'), {
      lineNumbers: true,
      theme: 'dracula',
      mode: 'wast',
      scrollbarStyle: 'null',
      lineWrapping: true,
      readOnly: true
    })
    let init = 
    `class FibonacciCalculator(object):\r  def calculate(self : FibonacciCalculator, x : int) -> int:\r    if x == 1 or x == 2:\r      return 1\r    return self.calculate(x - 1) + self.calculate(x - 2)\r\rfc : FibonacciCalculator = None\rfc = FibonacciCalculator()\rprint(fc.calculate(42))`
    this.py.setValue(init)
    this.worker.onmessage = (ev) => {
      let {wat, result, status} = ev.data
      this.wasm.setValue(wat)
      this.result = result
      this.working = status == 0
      this.error = status == -1
    }
  },
  methods: {
    runButton() {
      this.clear()
      this.working = true
      this.worker.postMessage(this.py.getValue())
    },
    clear() {
      this.wasm.setValue('')
      this.result = ''
      this.error = false
    }
  }
}
</script>

<template>
<div style="display: flex; flex-direction: column; justify-content: space-evenly;">
  <textarea id="python-code"></textarea>
  <div style="display: flex; flex-direction: column; justify-content: space-between; height: var(--output-height);">
    <button @click="runButton" :disabled="working">Compile & Run</button>
    <button @click="clear" :disabled="working">Clear</button>
  </div>
</div>
<div style="display: flex; flex-direction: column; justify-content: space-evenly;">
  <textarea id="wasm-code"></textarea>
  <textarea readonly v-model="result" :class="{error: error}"></textarea>
</div>
</template>

<style scoped>
textarea {
  box-sizing: border-box;
  width: var(--editor-width);
  height: var(--output-height);
  resize: none;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.5em 2em;
  font: inherit;
  background-color: rgb(38, 79, 79);
  transition: background-color 0.25s;
}

textarea::-webkit-scrollbar {
  display: none;
}

textarea.error {
  background-color: rgb(80, 28, 37);
}

button {
  width: var(--editor-width);
  height: calc(var(--output-height) / 2 - 1vh);
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.5em;
  font: inherit;
  background-color: #504563;
  cursor: pointer;
  transition: background-color .25s, opacity .25s;
}
button:hover {
  background-color: #8b449e;
}
button:active {
  opacity: 50%;
}
button[disabled] {
  opacity: 50%;
  cursor: auto;
}
button[disabled]:hover {
  background-color: #504563;
}
</style>
