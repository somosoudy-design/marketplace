### Recorridos con Maestro (2.11.0) sobre apk2.apk
```
01-visitante: pasó
01a-volver: FALLÓ
	at org.apache.logging.log4j.core.config.LoggerConfig.log(LoggerConfig.java:645)
	at org.apache.logging.log4j.core.config.LoggerConfig.log(LoggerConfig.java:589)
	at org.apache.logging.log4j.core.config.DefaultReliabilityStrategy.log(DefaultReliabilityStrategy.java:73)
	at org.apache.logging.log4j.core.Logger.log(Logger.java:187)
	at org.apache.logging.log4j.spi.AbstractLogger.tryLogMessage(AbstractLogger.java:2970)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessageTrackRecursion(AbstractLogger.java:2922)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessageSafely(AbstractLogger.java:2904)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessage(AbstractLogger.java:2653)
	at org.apache.logging.log4j.spi.AbstractLogger.logIfEnabled(AbstractLogger.java:2393)
	at org.apache.logging.slf4j.Log4jLogger.info(Log4jLogger.java:173)
	at maestro.drivers.AndroidDriver.close(AndroidDriver.kt:180)
	at maestro.Maestro.close(Maestro.kt:602)
	at maestro.cli.session.MaestroSessionManager$MaestroSession.close(MaestroSessionManager.kt:471)
	at maestro.cli.session.MaestroSessionManager.newSession$lambda$2(MaestroSessionManager.kt:129)
	at kotlin.concurrent.ThreadsKt$thread$thread$1.run(Thread.kt:30)
Caused by: java.io.IOException: Stream Closed
	at java.base/java.io.FileOutputStream.writeBytes(Native Method)
	at java.base/java.io.FileOutputStream.write(FileOutputStream.java:349)
	at org.apache.logging.log4j.core.appender.OutputStreamManager.writeToDestination(OutputStreamManager.java:263)
	... 30 more

2026-10-10T05:07:35.076528494Z Thread-5 ERROR An exception occurred processing Appender File
org.apache.logging.log4j.core.appender.AppenderLoggingException: Error writing to stream /home/runner/.maestro/tests/2026-10-10_050727/maestro.log
	at org.apache.logging.log4j.core.appender.OutputStreamManager.writeToDestination(OutputStreamManager.java:265)
	at org.apache.logging.log4j.core.appender.FileManager.writeToDestination(FileManager.java:335)
	at org.apache.logging.log4j.core.appender.OutputStreamManager.flushBuffer(OutputStreamManager.java:296)
	at org.apache.logging.log4j.core.appender.OutputStreamManager.flush(OutputStreamManager.java:307)
	at org.apache.logging.log4j.core.appender.AbstractOutputStreamAppender.directEncodeEvent(AbstractOutputStreamAppender.java:229)
	at org.apache.logging.log4j.core.appender.AbstractOutputStreamAppender.tryAppend(AbstractOutputStreamAppender.java:220)
	at org.apache.logging.log4j.core.appender.AbstractOutputStreamAppender.append(AbstractOutputStreamAppender.java:211)
	at org.apache.logging.log4j.core.config.AppenderControl.tryCallAppender(AppenderControl.java:160)
	at org.apache.logging.log4j.core.config.AppenderControl.callAppender0(AppenderControl.java:133)
	at org.apache.logging.log4j.core.config.AppenderControl.callAppenderPreventRecursion(AppenderControl.java:124)
	at org.apache.logging.log4j.core.config.AppenderControl.callAppender(AppenderControl.java:88)
	at org.apache.logging.log4j.core.config.LoggerConfig.callAppenders(LoggerConfig.java:711)
	at org.apache.logging.log4j.core.config.LoggerConfig.processLogEvent(LoggerConfig.java:669)
	at org.apache.logging.log4j.core.config.LoggerConfig.log(LoggerConfig.java:645)
	at org.apache.logging.log4j.core.config.LoggerConfig.logParent(LoggerConfig.java:702)
	at org.apache.logging.log4j.core.config.LoggerConfig.processLogEvent(LoggerConfig.java:671)
	at org.apache.logging.log4j.core.config.LoggerConfig.log(LoggerConfig.java:645)
	at org.apache.logging.log4j.core.config.LoggerConfig.log(LoggerConfig.java:589)
	at org.apache.logging.log4j.core.config.DefaultReliabilityStrategy.log(DefaultReliabilityStrategy.java:73)
	at org.apache.logging.log4j.core.Logger.log(Logger.java:187)
	at org.apache.logging.log4j.spi.AbstractLogger.tryLogMessage(AbstractLogger.java:2970)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessageTrackRecursion(AbstractLogger.java:2922)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessageSafely(AbstractLogger.java:2904)
	at org.apache.logging.log4j.spi.AbstractLogger.logMessage(AbstractLogger.java:2653)
	at org.apache.logging.log4j.spi.AbstractLogger.logIfEnabled(AbstractLogger.java:2393)
	at org.apache.logging.slf4j.Log4jLogger.info(Log4jLogger.java:173)
	at maestro.drivers.AndroidDriver.close(AndroidDriver.kt:180)
	at maestro.Maestro.close(Maestro.kt:602)
	at maestro.cli.session.MaestroSessionManager$MaestroSession.close(MaestroSessionManager.kt:471)
	at maestro.cli.session.MaestroSessionManager.newSession$lambda$2(MaestroSessionManager.kt:129)
	at kotlin.concurrent.ThreadsKt$thread$thread$1.run(Thread.kt:30)
Caused by: java.io.IOException: Stream Closed
	at java.base/java.io.FileOutputStream.writeBytes(Native Method)
	at java.base/java.io.FileOutputStream.write(FileOutputStream.java:349)
	at org.apache.logging.log4j.core.appender.OutputStreamManager.writeToDestination(OutputStreamManager.java:263)
	... 30 more

-- logcat de la app --
01b-volver-favoritos: FALLÓ

Waiting for flows to complete...
[Failed] Volver de Favoritos con la flecha (2s)

1/1 Flow Failed

-- logcat de la app --
01c-volver-favoritos-atras: FALLÓ

Waiting for flows to complete...
[Failed] Volver de Favoritos con atrás de Android (2s)

1/1 Flow Failed

-- logcat de la app --
02-cuenta: pasó
```
