import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

const replaces: { [key: string]: string } = {
  '\xA4': '\u20AC',
  '\xA6': '\u0160',
  '\xA8': '\u0161',
  '\xB4': '\u017D',
  '\xB8': '\u017E',
  '\xBC': '\u0152',
  '\xBD': '\u0153',
  '\xBE': '\u0178',
};

const unreplaces: { [key: string]: string } = {};
for (const key in replaces) {
  unreplaces[replaces[key]] = key;
}

const rep_reg = new RegExp(`[${Object.keys(replaces).join('')}]`, 'g');
const unrep_reg = new RegExp(`[${Object.keys(unreplaces).join('')}]`, 'g');

const decode = (data: string): [string, string] => {
  return [data.replace(rep_reg, (m) => replaces[m]), ''];
};

const encode = (data: string): string => {
  return data.replace(unrep_reg, (m) => unreplaces[m]);
};

class ISO885915Encoding {
    public proper = 'ISO-8859-15';
    public decode = decode;
    public encode = encode;
}

class ISO885915EncodingPlugin implements Plugin {
  public readonly name = 'iso885915';

  public install(decaf: DecafMUD): void {
    decaf.registerEncoding('iso885915', ISO885915Encoding);
  }
}

export const iso885915EncodingPlugin = new ISO885915EncodingPlugin();
