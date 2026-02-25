import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Fund } from './fund.entity';

@Entity('fund_navs')
@Index(['fund_code', 'date'], { unique: true })
export class FundNav {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  fund_code: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  nav: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  acc_nav: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  growth_rate: number;
}
