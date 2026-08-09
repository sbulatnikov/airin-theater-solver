import { describe, expect, it } from 'vitest';
import { engines } from './test-engines';

describe.each(engines)('%s: ввод реплик', (_path, engine) => {
  it('нормализует регистр и латинские эквиваленты', () => {
    expect(engine.normalizeText('  cз ')).toBe('СЗ');
    expect(engine.normalizeText('sK')).toBe('СК');
    expect(engine.sanitizeReplyInput(' уKz!! ')).toBe('КЗ');
  });

  it('принимает только две допустимые буквы', () => {
    expect(engine.parseReply('КЗ')).toEqual({ ok: true, value: 'КЗ' });
    expect(engine.parseReply('К').ok).toBe(false);
    expect(engine.parseReply('КЗС').ok).toBe(false);
    expect(engine.parseReply('УК').ok).toBe(false);
  });

  it('требует ровно три варианта', () => {
    expect(engine.parseOptions('СС СК').ok).toBe(false);
    expect(engine.parseOptions('СС СК СЗ КК').ok).toBe(false);
    expect(engine.parseOptions('СС СК СЗ').ok).toBe(true);
  });

  it('считает обратный порядок букв дублем', () => {
    expect(engine.replySignature('КЗ')).toBe(engine.replySignature('ЗК'));
    expect(engine.parseOptions('КЗ ЗК СС').ok).toBe(false);
  });

  it('очищает длинную ошибочную строку и затем отклоняет дубли', () => {
    const sanitized = engine.sanitizeOptionsInput('КЗ ЗК ЗК УКУ У');
    expect(sanitized).toBe('КЗ ЗК ЗК');
    expect(engine.parseOptions(sanitized).ok).toBe(false);
  });
});
