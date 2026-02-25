import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('backtest_results')
export class BacktestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  strategy_config: any;

  @Column()
  fund_code: string;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  initial_capital: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  final_value: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  total_return: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  annual_return: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  max_drawdown: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  sharpe_ratio: number;

  @Column({ type: 'int' })
  trades_count: number;

  @CreateDateColumn()
  created_at: Date;
}
