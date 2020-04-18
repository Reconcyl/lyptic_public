import {clamp} from "../../../../voxel-engine/utils/scalar";

export class SharedHpController {
    public raw_health: number;

    constructor(initial_health: number, public readonly max_health: number) {
        this.raw_health = this.sanitizeHealth(initial_health);
    }

    private sanitizeHealth(hp: number): number {
        return clamp(hp, 0, this.max_health);
    }

    setHealth(hp: number) {
        this.raw_health = this.sanitizeHealth(hp);
    }

    modifyHealth(delta: number): boolean {
        this.setHealth(this.raw_health + delta);
        return this.isDead();
    }

    isDead() {
        return this.raw_health <= 0;
    }
}