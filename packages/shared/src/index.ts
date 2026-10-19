// Общие для сервера и интерфейса значения и типы.
// Zod-схемы модулей лежат отдельными файлами в src/schemas/<модуль>.ts и импортируются
// напрямую: import { ... } from '@sport/shared/schemas/events'. Так участники не правят этот файл.
export * from './enums';
export * from './errors';
export * from './demo';
