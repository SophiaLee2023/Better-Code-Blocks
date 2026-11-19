import { readFile } from 'fs/promises';

export interface Robot {
  name: string;
  speed: number;
}

type Status = 'idle' | 'moving';

export class Fleet<T extends Robot> {
  private robots: T[] = [];
  static readonly MAX_SIZE = 10;

  add(robot: T): boolean {
    if (this.robots.length >= Fleet.MAX_SIZE) return false;
    this.robots.push(robot);
    return /^[a-z]+$/i.test(robot.name);
  }

  async load(path: string): Promise<void> {
    const data = JSON.parse(await readFile(path, 'utf8'));
    console.log(`loaded ${data.length} robots`);
  }
}
