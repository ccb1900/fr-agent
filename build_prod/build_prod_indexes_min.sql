-- ============================================================
-- build_prod_indexes_min.sql — 索引定稿 v2（按天TOP分页早停用）
-- 复合键序必须 = 分页内层排序键：(日期, 时间, file_key, row_number)。
-- 少一列或顺序不对，SQL Server 就会排整天才取 50 行（生产 10s 的根因）。
-- 旧的单列/三列日期索引都会被替换，脚本内自动 DROP。
-- ============================================================
SET NOCOUNT ON;

-- files
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_laser_files_source' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_files')) CREATE NONCLUSTERED INDEX IX_laser_files_source ON [t_collector_laser_files] ([source_id]) INCLUDE ([file_key]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_laser_files_fkey' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_files')) CREATE NONCLUSTERED INDEX IX_laser_files_fkey ON [t_collector_laser_files] ([file_key]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_laser_files_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_files')) CREATE NONCLUSTERED INDEX IX_laser_files_date ON [t_collector_laser_files] ([collection_date]);

-- aaa
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa')) DROP INDEX IX_aaa_date ON [t_collector_laser_aaa];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa')) DROP INDEX IX_aaa_date_ord ON [t_collector_laser_aaa];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa')) CREATE NONCLUSTERED INDEX IX_aaa_date_ord ON [t_collector_laser_aaa] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa')) CREATE NONCLUSTERED INDEX IX_aaa_fk ON [t_collector_laser_aaa] ([file_key]);
-- aaa_gosa
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_gosa_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa_gosa')) DROP INDEX IX_aaa_gosa_date ON [t_collector_laser_aaa_gosa];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_gosa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa_gosa')) DROP INDEX IX_aaa_gosa_date_ord ON [t_collector_laser_aaa_gosa];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_gosa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa_gosa')) CREATE NONCLUSTERED INDEX IX_aaa_gosa_date_ord ON [t_collector_laser_aaa_gosa] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aaa_gosa_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_aaa_gosa')) CREATE NONCLUSTERED INDEX IX_aaa_gosa_fk ON [t_collector_laser_aaa_gosa] ([file_key]);
-- alm_log
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_alm_log_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_alm_log')) DROP INDEX IX_alm_log_date ON [t_collector_laser_alm_log];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_alm_log_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_alm_log')) DROP INDEX IX_alm_log_date_ord ON [t_collector_laser_alm_log];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_alm_log_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_alm_log')) CREATE NONCLUSTERED INDEX IX_alm_log_date_ord ON [t_collector_laser_alm_log] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_alm_log_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_alm_log')) CREATE NONCLUSTERED INDEX IX_alm_log_fk ON [t_collector_laser_alm_log] ([file_key]);
-- cnd_selct
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_cnd_selct_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_cnd_selct')) DROP INDEX IX_cnd_selct_date ON [t_collector_laser_cnd_selct];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_cnd_selct_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_cnd_selct')) DROP INDEX IX_cnd_selct_date_ord ON [t_collector_laser_cnd_selct];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_cnd_selct_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_cnd_selct')) CREATE NONCLUSTERED INDEX IX_cnd_selct_date_ord ON [t_collector_laser_cnd_selct] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_cnd_selct_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_cnd_selct')) CREATE NONCLUSTERED INDEX IX_cnd_selct_fk ON [t_collector_laser_cnd_selct] ([file_key]);
-- energy_measure
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_energy_measure_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_energy_measure')) DROP INDEX IX_energy_measure_date ON [t_collector_laser_energy_measure];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_energy_measure_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_energy_measure')) DROP INDEX IX_energy_measure_date_ord ON [t_collector_laser_energy_measure];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_energy_measure_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_energy_measure')) CREATE NONCLUSTERED INDEX IX_energy_measure_date_ord ON [t_collector_laser_energy_measure] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_energy_measure_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_energy_measure')) CREATE NONCLUSTERED INDEX IX_energy_measure_fk ON [t_collector_laser_energy_measure] ([file_key]);
-- galv_mask_measure
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_galv_mask_measure_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_galv_mask_measure')) DROP INDEX IX_galv_mask_measure_date ON [t_collector_laser_galv_mask_measure];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_galv_mask_measure_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_galv_mask_measure')) DROP INDEX IX_galv_mask_measure_date_ord ON [t_collector_laser_galv_mask_measure];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_galv_mask_measure_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_galv_mask_measure')) CREATE NONCLUSTERED INDEX IX_galv_mask_measure_date_ord ON [t_collector_laser_galv_mask_measure] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_galv_mask_measure_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_galv_mask_measure')) CREATE NONCLUSTERED INDEX IX_galv_mask_measure_fk ON [t_collector_laser_galv_mask_measure] ([file_key]);
-- glv_cnd_send
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_glv_cnd_send_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_glv_cnd_send')) DROP INDEX IX_glv_cnd_send_date ON [t_collector_laser_glv_cnd_send];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_glv_cnd_send_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_glv_cnd_send')) DROP INDEX IX_glv_cnd_send_date_ord ON [t_collector_laser_glv_cnd_send];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_glv_cnd_send_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_glv_cnd_send')) CREATE NONCLUSTERED INDEX IX_glv_cnd_send_date_ord ON [t_collector_laser_glv_cnd_send] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_glv_cnd_send_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_glv_cnd_send')) CREATE NONCLUSTERED INDEX IX_glv_cnd_send_fk ON [t_collector_laser_glv_cnd_send] ([file_key]);
-- length
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_length_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_length')) DROP INDEX IX_length_date ON [t_collector_laser_length];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_length_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_length')) DROP INDEX IX_length_date_ord ON [t_collector_laser_length];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_length_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_length')) CREATE NONCLUSTERED INDEX IX_length_date_ord ON [t_collector_laser_length] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_length_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_length')) CREATE NONCLUSTERED INDEX IX_length_fk ON [t_collector_laser_length] ([file_key]);
-- m307
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m307_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m307')) DROP INDEX IX_m307_date ON [t_collector_laser_m307];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m307_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m307')) DROP INDEX IX_m307_date_ord ON [t_collector_laser_m307];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m307_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m307')) CREATE NONCLUSTERED INDEX IX_m307_date_ord ON [t_collector_laser_m307] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m307_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m307')) CREATE NONCLUSTERED INDEX IX_m307_fk ON [t_collector_laser_m307] ([file_key]);
-- m370
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m370_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m370')) DROP INDEX IX_m370_date ON [t_collector_laser_m370];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m370_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m370')) DROP INDEX IX_m370_date_ord ON [t_collector_laser_m370];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m370_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m370')) CREATE NONCLUSTERED INDEX IX_m370_date_ord ON [t_collector_laser_m370] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m370_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m370')) CREATE NONCLUSTERED INDEX IX_m370_fk ON [t_collector_laser_m370] ([file_key]);
-- m377
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m377_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m377')) DROP INDEX IX_m377_date ON [t_collector_laser_m377];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m377_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m377')) DROP INDEX IX_m377_date_ord ON [t_collector_laser_m377];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m377_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m377')) CREATE NONCLUSTERED INDEX IX_m377_date_ord ON [t_collector_laser_m377] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_m377_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_m377')) CREATE NONCLUSTERED INDEX IX_m377_fk ON [t_collector_laser_m377] ([file_key]);
-- mainte1
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mainte1_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mainte1')) DROP INDEX IX_mainte1_date ON [t_collector_laser_mainte1];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mainte1_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mainte1')) DROP INDEX IX_mainte1_date_ord ON [t_collector_laser_mainte1];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mainte1_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mainte1')) CREATE NONCLUSTERED INDEX IX_mainte1_date_ord ON [t_collector_laser_mainte1] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mainte1_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mainte1')) CREATE NONCLUSTERED INDEX IX_mainte1_fk ON [t_collector_laser_mainte1] ([file_key]);
-- mask_gosa
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mask_gosa_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mask_gosa')) DROP INDEX IX_mask_gosa_date ON [t_collector_laser_mask_gosa];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mask_gosa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mask_gosa')) DROP INDEX IX_mask_gosa_date_ord ON [t_collector_laser_mask_gosa];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mask_gosa_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mask_gosa')) CREATE NONCLUSTERED INDEX IX_mask_gosa_date_ord ON [t_collector_laser_mask_gosa] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_mask_gosa_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_mask_gosa')) CREATE NONCLUSTERED INDEX IX_mask_gosa_fk ON [t_collector_laser_mask_gosa] ([file_key]);
-- pc_direct
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pc_direct_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pc_direct')) DROP INDEX IX_pc_direct_date ON [t_collector_laser_pc_direct];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pc_direct_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pc_direct')) DROP INDEX IX_pc_direct_date_ord ON [t_collector_laser_pc_direct];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pc_direct_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pc_direct')) CREATE NONCLUSTERED INDEX IX_pc_direct_date_ord ON [t_collector_laser_pc_direct] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pc_direct_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pc_direct')) CREATE NONCLUSTERED INDEX IX_pc_direct_fk ON [t_collector_laser_pc_direct] ([file_key]);
-- proc_state
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_proc_state_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_proc_state')) DROP INDEX IX_proc_state_date ON [t_collector_laser_proc_state];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_proc_state_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_proc_state')) DROP INDEX IX_proc_state_date_ord ON [t_collector_laser_proc_state];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_proc_state_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_proc_state')) CREATE NONCLUSTERED INDEX IX_proc_state_date_ord ON [t_collector_laser_proc_state] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_proc_state_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_proc_state')) CREATE NONCLUSTERED INDEX IX_proc_state_fk ON [t_collector_laser_proc_state] ([file_key]);
-- pwr
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwr_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwr')) DROP INDEX IX_pwr_date ON [t_collector_laser_pwr];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwr_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwr')) DROP INDEX IX_pwr_date_ord ON [t_collector_laser_pwr];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwr_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwr')) CREATE NONCLUSTERED INDEX IX_pwr_date_ord ON [t_collector_laser_pwr] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwr_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwr')) CREATE NONCLUSTERED INDEX IX_pwr_fk ON [t_collector_laser_pwr] ([file_key]);
-- pwrmulti
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwrmulti_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwrmulti')) DROP INDEX IX_pwrmulti_date ON [t_collector_laser_pwrmulti];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwrmulti_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwrmulti')) DROP INDEX IX_pwrmulti_date_ord ON [t_collector_laser_pwrmulti];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwrmulti_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwrmulti')) CREATE NONCLUSTERED INDEX IX_pwrmulti_date_ord ON [t_collector_laser_pwrmulti] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pwrmulti_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_pwrmulti')) CREATE NONCLUSTERED INDEX IX_pwrmulti_fk ON [t_collector_laser_pwrmulti] ([file_key]);
-- sensor
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sensor_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sensor')) DROP INDEX IX_sensor_date ON [t_collector_laser_sensor];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sensor_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sensor')) DROP INDEX IX_sensor_date_ord ON [t_collector_laser_sensor];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sensor_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sensor')) CREATE NONCLUSTERED INDEX IX_sensor_date_ord ON [t_collector_laser_sensor] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sensor_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sensor')) CREATE NONCLUSTERED INDEX IX_sensor_fk ON [t_collector_laser_sensor] ([file_key]);
-- sin_statis
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sin_statis_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sin_statis')) DROP INDEX IX_sin_statis_date ON [t_collector_laser_sin_statis];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sin_statis_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sin_statis')) DROP INDEX IX_sin_statis_date_ord ON [t_collector_laser_sin_statis];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sin_statis_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sin_statis')) CREATE NONCLUSTERED INDEX IX_sin_statis_date_ord ON [t_collector_laser_sin_statis] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sin_statis_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sin_statis')) CREATE NONCLUSTERED INDEX IX_sin_statis_fk ON [t_collector_laser_sin_statis] ([file_key]);
-- sinsyuku
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sinsyuku_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sinsyuku')) DROP INDEX IX_sinsyuku_date ON [t_collector_laser_sinsyuku];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sinsyuku_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sinsyuku')) DROP INDEX IX_sinsyuku_date_ord ON [t_collector_laser_sinsyuku];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sinsyuku_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sinsyuku')) CREATE NONCLUSTERED INDEX IX_sinsyuku_date_ord ON [t_collector_laser_sinsyuku] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sinsyuku_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_sinsyuku')) CREATE NONCLUSTERED INDEX IX_sinsyuku_fk ON [t_collector_laser_sinsyuku] ([file_key]);
-- table
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_table_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_table')) DROP INDEX IX_table_date ON [t_collector_laser_table];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_table_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_table')) DROP INDEX IX_table_date_ord ON [t_collector_laser_table];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_table_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_table')) CREATE NONCLUSTERED INDEX IX_table_date_ord ON [t_collector_laser_table] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_table_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_table')) CREATE NONCLUSTERED INDEX IX_table_fk ON [t_collector_laser_table] ([file_key]);
-- twin_scale_dsp
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_twin_scale_dsp_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_twin_scale_dsp')) DROP INDEX IX_twin_scale_dsp_date ON [t_collector_laser_twin_scale_dsp];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_twin_scale_dsp_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_twin_scale_dsp')) DROP INDEX IX_twin_scale_dsp_date_ord ON [t_collector_laser_twin_scale_dsp];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_twin_scale_dsp_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_twin_scale_dsp')) CREATE NONCLUSTERED INDEX IX_twin_scale_dsp_date_ord ON [t_collector_laser_twin_scale_dsp] ([Date],[Time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_twin_scale_dsp_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_twin_scale_dsp')) CREATE NONCLUSTERED INDEX IX_twin_scale_dsp_fk ON [t_collector_laser_twin_scale_dsp] ([file_key]);
-- zaxis
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_zaxis_date' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_zaxis')) DROP INDEX IX_zaxis_date ON [t_collector_laser_zaxis];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_zaxis_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_zaxis')) DROP INDEX IX_zaxis_date_ord ON [t_collector_laser_zaxis];
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_zaxis_date_ord' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_zaxis')) CREATE NONCLUSTERED INDEX IX_zaxis_date_ord ON [t_collector_laser_zaxis] ([biz_date],[biz_time],[file_key],[row_number]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_zaxis_fk' AND object_id=OBJECT_ID(N'[dbo].t_collector_laser_zaxis')) CREATE NONCLUSTERED INDEX IX_zaxis_fk ON [t_collector_laser_zaxis] ([file_key]);
GO
