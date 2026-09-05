-- Micro-Tanks Arena 3D — MySQL schema (REQ-SRV-DB)
CREATE DATABASE IF NOT EXISTS micro_tanks
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE micro_tanks;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
);

CREATE TABLE IF NOT EXISTS scores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  score INT NOT NULL,
  mode ENUM('PVE', 'PVP') NOT NULL,
  difficulty ENUM('EASY', 'HARD') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scores_score (score DESC),
  CONSTRAINT fk_scores_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);
