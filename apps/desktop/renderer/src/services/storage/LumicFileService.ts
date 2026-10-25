import {
  CompileResult,
  LumiProject,
  LumiCompiledArtifact,
  ContractValidationError,
  ContractValidationResult,
} from '../../types';
import {
  createLumicArtifactFromCompileResult,
  validateLumicArtifact,
  serializeLumicArtifact,
  parseAndValidateLumicArtifact,
} from '../compiler/contracts/contractValidator';
import { ideLogger } from '../logger/IdeLogService';

export interface LumicExportResult {
  success: boolean;
  error?: string;
  artifact?: LumiCompiledArtifact;
  fileName?: string;
  rawJson?: string;
}

export interface LumicImportResult {
  success: boolean;
  error?: string;
  artifact?: LumiCompiledArtifact;
  validationErrors?: ContractValidationError[];
}

/**
 * Servicio para la exportación y carga de artefactos compilados .lumic
 */
export class LumicFileService {
  /**
   * Valida si existe un resultado de compilación apto para ser exportado.
   */
  public static validateForExport(
    compileResult: CompileResult | null,
    project: LumiProject | null
  ): { canExport: boolean; error?: string; artifact?: LumiCompiledArtifact } {
    if (!compileResult) {
      return {
        canExport: false,
        error: 'No hay ningún resultado disponible. Ejecuta un programa con habitaciones para obtener una escena exportable. Compilar solo analiza el código.',
      };
    }

    if (!compileResult.success || compileResult.status === 'blocked') {
      return {
        canExport: false,
        error: 'No se puede exportar un resultado fallido o incompleto. Revisa la consola y los diagnósticos; después ejecuta el programa para obtener una escena válida.',
      };
    }

    if (!compileResult.scenePlan || !compileResult.scenePlan.rooms || compileResult.scenePlan.rooms.length === 0) {
      return {
        canExport: false,
        error: 'El resultado actual no contiene habitaciones ni elementos espaciales exportables. Compilar solo analiza el código; ejecuta un programa con habitaciones para generar una escena.',
      };
    }

    const artifact = createLumicArtifactFromCompileResult(compileResult, {
      id: project?.id || 'export-local',
      name: project?.name || 'EscenaLumi',
      filesCount: project?.files?.length || 1,
      entryFile: project?.files?.find((f) => f.isEntry)?.name || compileResult.entryFileInfo?.name || 'principal.lumi',
    });

    if (!artifact) {
      return {
        canExport: false,
        error: 'No fue posible estructurar el artefacto compilado a partir del resultado actual.',
      };
    }

    const validation = validateLumicArtifact(artifact);
    if (!validation.isValid) {
      const errorMsg = validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
      return {
        canExport: false,
        error: `El artefacto no superó la validación del contrato .lumic: ${errorMsg}`,
      };
    }

    return {
      canExport: true,
      artifact,
    };
  }

  /**
   * Genera el artefacto .lumic y dispara la descarga en el navegador.
   */
  public static exportLumic(
    compileResult: CompileResult | null,
    project: LumiProject | null
  ): LumicExportResult {
    const validation = this.validateForExport(compileResult, project);
    if (!validation.canExport || !validation.artifact) {
      ideLogger.log(
        'warning',
        validation.error || 'Exportación cancelada.',
        undefined,
        'Artefacto .lumic'
      );
      return {
        success: false,
        error: validation.error,
      };
    }

    const artifact = validation.artifact;
    const rawJson = serializeLumicArtifact(artifact, true);
    const sanitizedBase = (project?.name || 'escena_lumi')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/gi, '_');
    const fileName = `${sanitizedBase}.lumic`;

    if (!this.downloadInBrowser(rawJson, fileName)) {
      return { success: false, error: 'No se pudo iniciar la descarga del archivo .lumic. Intenta exportarlo nuevamente.' };
    }

    ideLogger.log(
      'success',
      `Descarga de "${fileName}" iniciada (${artifact.scenePlan.rooms.length} hab., ${
        artifact.scenePlan.rooms.reduce((acc, r) => acc + r.objects.length, 0)
      } obj.).`,
      undefined,
      'Artefacto .lumic'
    );

    return {
      success: true,
      artifact,
      fileName,
      rawJson,
    };
  }

  /**
   * Descarga segura de un archivo en el navegador web o entorno de test.
   */
  public static downloadInBrowser(content: string, fileName: string): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url =
        typeof window.URL?.createObjectURL === 'function'
          ? window.URL.createObjectURL(blob)
          : `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (typeof window.URL?.revokeObjectURL === 'function') {
        window.URL.revokeObjectURL(url);
      }
      return true;
    } catch (err) {
      console.error('Error al descargar archivo .lumic:', err);
      return false;
    }
  }

  /**
   * Parsea y valida el contenido de texto de un archivo .lumic.
   */
  public static parseAndValidateContent(content: string): LumicImportResult {
    const validation = parseAndValidateLumicArtifact(content);

    if (!validation.isValid) {
      const mainError = validation.errors[0];
      let humanMessage = 'El archivo no cumple con los formatos .lumic compatibles con este IDE (1.0.0 y 1.1.0).';

      if (mainError) {
        if (mainError.code === 'MALFORMED_JSON') {
          humanMessage = 'El archivo está corrupto o no contiene un formato JSON válido.';
        } else if (mainError.code === 'INCOMPATIBLE_VERSION') {
          humanMessage = `Versión incompatible: ${mainError.message}`;
        } else if (mainError.code === 'INVALID_SPATIAL_REFERENCE') {
          humanMessage = `Referencia espacial inválida en el artefacto: ${mainError.message}`;
        } else if (mainError.code === 'MISSING_REQUIRED_FIELD') {
          humanMessage = `Campo obligatorio faltante: ${mainError.message}`;
        }
      }

      return {
        success: false,
        error: humanMessage,
        validationErrors: validation.errors,
      };
    }

    return {
      success: true,
      artifact: validation.data!,
    };
  }

  /**
   * Lee un archivo del sistema de archivos del usuario (objeto File) y lo valida.
   */
  public static async readAndValidateFile(file: File): Promise<LumicImportResult> {
    try {
      const text = await file.text();
      return this.parseAndValidateContent(text);
    } catch (err) {
      const msg = `No se pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}`;
      return {
        success: false,
        error: msg,
      };
    }
  }
}
