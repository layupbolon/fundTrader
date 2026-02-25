import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Fund } from './fund.entity';
import { StrategyType } from './enums';

@Entity('strategies')
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: StrategyType })
  type: StrategyType;

  @Column()
  fund_code: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  @Column({ type: 'jsonb' })
  config: any;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;
}
