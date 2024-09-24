// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import {type ChildProcess, spawn} from 'child_process'

interface Process {
    name: string
    command: string
    args: string[]
}

const processes: Process[] = [
    { name: 'worker', command: 'tsx', args: ['src/app.ts', 'worker'] },
    { name: 'backfill', command: 'tsx', args: ['src/app.ts', 'backfill'] },
    { name: 'start', command: 'tsx', args: ['src/app.ts', 'start'] },
]

for (const proc of processes) {
    const child: ChildProcess = spawn(proc.command, proc.args, {
        stdio: 'inherit',
    })

    child.on('error', (error: Error) => {
        console.error(`${proc.name} process error:`, error)
    })

    child.on('close', (code: number | null) => {
        console.log(`${proc.name} process exited with code ${code}`)
        // Restart the process if it exits
        console.log(`Restarting ${proc.name} process...`)
        spawn(proc.command, proc.args, { stdio: 'inherit' })
    })
}

console.log('All processes started. Container will keep running.')
