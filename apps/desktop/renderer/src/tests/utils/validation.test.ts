import { describe, it, expect } from 'vitest';
import {
  validateProjectName,
  validateProjectLocation,
  validateFileName,
  validateRoomParams,
} from '../../utils/validation';

describe('Validation Utilities', () => {
  describe('validateRoomParams', () => {
    it('debe aceptar parámetros válidos y generar código Lumi correctamente formateado', () => {
      const res = validateRoomParams('sala_principal', '5.0', '4.0', '2.7');
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
      expect(res.generatedCode).toBe('habitacion sala_principal(5.0, 4.0, 2.7) {\n}');
      expect(res.cleanValues).toEqual({
        name: 'sala_principal',
        ancho: 5.0,
        largo: 4.0,
        altura: 2.7,
      });
    });

    it('debe rechazar nombre vacío o con espacios en blanco', () => {
      const res = validateRoomParams('   ', '5.0', '4.0', '2.7');
      expect(res.isValid).toBe(false);
      expect(res.errors.name).toContain('obligatorio');
    });

    it('debe rechazar nombres que no sean identificadores válidos en Lumi', () => {
      // Iniciar con número
      const res1 = validateRoomParams('1habitacion', '5.0', '4.0', '2.7');
      expect(res1.isValid).toBe(false);
      expect(res1.errors.name).toBeDefined();

      // Caracteres especiales
      const res2 = validateRoomParams('sala-grande!', '5.0', '4.0', '2.7');
      expect(res2.isValid).toBe(false);
      expect(res2.errors.name).toBeDefined();
    });

    it('debe rechazar ancho menor o igual a cero', () => {
      const resZero = validateRoomParams('sala', '0', '4.0', '2.7');
      expect(resZero.isValid).toBe(false);
      expect(resZero.errors.ancho).toContain('mayor a 0');

      const resNegative = validateRoomParams('sala', '-3.5', '4.0', '2.7');
      expect(resNegative.isValid).toBe(false);
      expect(resNegative.errors.ancho).toContain('mayor a 0');
    });

    it('debe rechazar largo y altura inválidos o negativos', () => {
      const resLargo = validateRoomParams('sala', '5.0', '0.0', '2.7');
      expect(resLargo.isValid).toBe(false);
      expect(resLargo.errors.largo).toBeDefined();

      const resAltura = validateRoomParams('sala', '5.0', '4.0', '-1.0');
      expect(resAltura.isValid).toBe(false);
      expect(resAltura.errors.altura).toBeDefined();
    });

    it('debe admitir decimales con coma o con punto y formatear enteros con decimal .0', () => {
      const resComma = validateRoomParams('cocina', '3,5', '2,8', '2,4');
      expect(resComma.isValid).toBe(true);
      expect(resComma.cleanValues?.ancho).toBe(3.5);
      expect(resComma.cleanValues?.largo).toBe(2.8);
      expect(resComma.cleanValues?.altura).toBe(2.4);
      expect(resComma.generatedCode).toBe('habitacion cocina(3.5, 2.8, 2.4) {\n}');

      // Enteros deben formatearse con .0
      const resInt = validateRoomParams('estudio', '4', '3', '3');
      expect(resInt.isValid).toBe(true);
      expect(resInt.generatedCode).toBe('habitacion estudio(4.0, 3.0, 3.0) {\n}');
    });
  });

  describe('validateFileName', () => {
    it('debe agregar automáticamente la extensión .lumi si no se provee', () => {
      const res = validateFileName('modulo_dormitorio');
      expect(res.isValid).toBe(true);
      expect(res.cleanValue).toBe('modulo_dormitorio.lumi');
    });

    it('debe rechazar duplicados en la lista de nombres existentes', () => {
      const existing = ['principal.lumi', 'cocina.lumi'];
      const res = validateFileName('cocina.lumi', existing);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Ya existe');
    });

    it('debe permitir conservar el mismo nombre si es el archivo original al renombrar', () => {
      const existing = ['principal.lumi', 'cocina.lumi'];
      const res = validateFileName('cocina.lumi', existing, 'cocina.lumi');
      expect(res.isValid).toBe(true);
    });
  });

  describe('validateProjectName', () => {
    it('debe validar longitud y caracteres permitidos', () => {
      expect(validateProjectName('A').isValid).toBe(false); // Muy corto
      expect(validateProjectName('Proyecto/Invalido').isValid).toBe(false); // Carácter inválido
      expect(validateProjectName('Mi Espacio 3D').isValid).toBe(true);
    });
  });
});
