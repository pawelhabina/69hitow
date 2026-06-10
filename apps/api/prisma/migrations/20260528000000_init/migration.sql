CREATE TABLE `Crossword` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  `gridRows` INTEGER NOT NULL DEFAULT 15,
  `gridColumns` INTEGER NOT NULL DEFAULT 15,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CrosswordEntry` (
  `id` VARCHAR(191) NOT NULL,
  `crosswordId` VARCHAR(191) NOT NULL,
  `type` ENUM('GUESS_TITLE_FROM_AUDIO', 'GUESS_ARTIST_FROM_AUDIO', 'COMPLETE_LYRIC', 'TEXT_CLUE') NOT NULL,
  `answer` VARCHAR(191) NOT NULL,
  `normalizedAnswer` VARCHAR(191) NOT NULL,
  `clueText` TEXT NULL,
  `audioPath` VARCHAR(191) NULL,
  `songTitle` VARCHAR(191) NULL,
  `artist` VARCHAR(191) NULL,
  `spotifyUrl` VARCHAR(191) NULL,
  `youtubeUrl` VARCHAR(191) NULL,
  `direction` ENUM('ACROSS', 'DOWN') NOT NULL,
  `startRow` INTEGER NOT NULL,
  `startColumn` INTEGER NOT NULL,
  `orderNumber` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Crossword_status_publishedAt_idx` ON `Crossword`(`status`, `publishedAt`);
CREATE INDEX `CrosswordEntry_crosswordId_orderNumber_idx` ON `CrosswordEntry`(`crosswordId`, `orderNumber`);
ALTER TABLE `CrosswordEntry` ADD CONSTRAINT `CrosswordEntry_crosswordId_fkey` FOREIGN KEY (`crosswordId`) REFERENCES `Crossword`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
