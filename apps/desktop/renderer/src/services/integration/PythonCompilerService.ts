import type { LumiProject, CompileResult } from '../../types';
import type { CompilerService } from '../compiler/CompilerService';
import type { DesktopBridge } from './desktopBridge';
import { validateProtocolResponse } from './protocol/responseValidator';
import type { Operation } from './protocol/types';
import { projectInput } from './projectInput';
import { adaptBackendResult } from './resultAdapter';
import { isRecord } from './protocol/validationHelpers';

export class PythonCompilerService implements CompilerService {
  readonly mode = 'python' as const;
  constructor(private readonly bridge: DesktopBridge | undefined) {}

  compile(project: LumiProject): Promise<CompileResult> { return this.run('analyze', project); }
  execute(project: LumiProject): Promise<CompileResult> { return this.run('execute', project); }

  private async run(operation: Operation, project: LumiProject): Promise<CompileResult> {
    if (!this.bridge) throw new Error('El puente seguro de Electron no está disponible. No se utilizará el mock.');
    const started = performance.now();
    const input = projectInput(project);
    const reply: unknown = await this.bridge[operation](input);
    if (!isRecord(reply) || reply.ok !== true) {
      if (isRecord(reply) && reply.ok === false && isRecord(reply.error)
        && typeof reply.error.code === 'string' && typeof reply.error.message === 'string') {
        throw new Error(`[${reply.error.code}] ${reply.error.message}`);
      }
      throw new Error('Respuesta IPC inválida.');
    }
    const validation = validateProtocolResponse(reply.response);
    if (validation.valid === false) throw new Error(`Contrato Python inválido: ${validation.errors.join(' ')}`);
    const response = validation.value;
    if (response.operation !== operation) throw new Error('La operación recibida no coincide con la solicitud.');
    if (response.status === 'error') throw new Error(`[${response.error.code}] ${response.error.message}`);
    if (response.result.entryFile !== input.entryFile) throw new Error('El archivo principal recibido no coincide.');
    return adaptBackendResult(response, project, performance.now() - started);
  }
}
