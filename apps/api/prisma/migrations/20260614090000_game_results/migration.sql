CREATE TABLE `GameResult` (
  `id` VARCHAR(191) NOT NULL,
  `playerId` VARCHAR(191) NOT NULL,
  `crosswordId` VARCHAR(191) NOT NULL,
  `solvedCount` INTEGER NOT NULL,
  `givenUpCount` INTEGER NOT NULL,
  `totalEntries` INTEGER NOT NULL,
  `completed` BOOLEAN NOT NULL,
  `surrendered` BOOLEAN NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `GameResult_playerId_createdAt_idx`(`playerId`, `createdAt`),
  INDEX `GameResult_crosswordId_createdAt_idx`(`crosswordId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameResult` ADD CONSTRAINT `GameResult_crosswordId_fkey` FOREIGN KEY (`crosswordId`) REFERENCES `Crossword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
