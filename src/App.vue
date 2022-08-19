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
<main style="display: grid; grid-template-columns: 50% 50%; grid-gap: 10px;">
  <div style="display: flex; flex-direction: column;">
    <textarea id="python-code"></textarea>
    <button style="margin-top: 10px;" @click="runButton" :disabled="working">Compile & Run</button>
    <button style="margin-top: 10px;" @click="clear" :disabled="working">Clear</button>
  </div>
  <div style="display: flex; flex-direction: column;">
    <textarea id="wasm-code"></textarea>
    <textarea style="margin-top: 10px;" readonly id="result" v-model="result" :class="{error: error}"></textarea>
  </div>
</main>
</template>

<style scoped>
textarea {
  width: 534px;
  height: 92px;
  font-size: 1em;
  font-weight: 500;
  resize: none;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0.5em 2em;
  font-family: inherit;
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
  width: 600px;
  height: 50px;
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.5em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #504563;
  cursor: pointer;
  transition: 0.25s;
}
button:hover {
  background-color: #8b449e;
}
button[disabled] {
  opacity: 50%;
  cursor: auto;
}
button[disabled]:hover {
  background-color: #504563;
}
</style>
