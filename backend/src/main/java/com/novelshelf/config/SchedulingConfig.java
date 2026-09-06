package com.novelshelf.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** {@code @Scheduled}（更新検知ジョブ等）を有効化する。 */
@Configuration
@EnableScheduling
public class SchedulingConfig {}
