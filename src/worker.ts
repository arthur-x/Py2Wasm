import {compile, run} from './compiler'

onmessage = async (ev) => {
  let py = ev.data
  let ret = { wat: '', result: '', status: 0}
  function display(arg : any) {
    ret['result'] += arg + '\n'
  }
  const memory = new WebAssembly.Memory({initial:10, maximum:100})
  const importObject = {
    imports: {
      print_num: (arg: any) => {
        display(String(arg))
        return arg
      },
      print_bool: (arg: any) => {
        if (arg === 0) display("False")
        else display("True")
        return arg
      },
      print_none: (arg: any) => {
        display("None")
        return arg
      },
      abs : Math.abs, 
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      mem: memory
    }
  }
  try {
    const wat = compile(py)
    ret['wat'] = wat
    postMessage(ret)
    await run(wat, {importObject})
    ret['status'] = 1
  }
  catch(e) { 
    display(String(e))
    ret['status'] = -1
  }
  postMessage(ret)
}