package store

import (
	"context"
	"errors"
	"strings"
)

// GetUserByEmail fetches a user by email.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT id::text, email, password_hash, COALESCE(name, ''), role, created_at, updated_at FROM users WHERE email=$1`, email)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUserByID fetches a user by ID.
func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT id::text, email, password_hash, COALESCE(name, ''), role, created_at, updated_at FROM users WHERE id=$1`, id)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateUser inserts a new user row.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash, name, role string) (*User, error) {
	if email == "" {
		return nil, errors.New("email required")
	}
	if passwordHash == "" {
		return nil, errors.New("password hash required")
	}
	if role == "" {
		role = "owner"
	}

	trimmedName := strings.TrimSpace(name)
	var nameValue *string
	if trimmedName != "" {
		nameValue = &trimmedName
	}

	row := s.pool.QueryRow(ctx, `INSERT INTO users (email, password_hash, name, role)
		VALUES ($1,$2,$3,$4)
		RETURNING id::text, email, password_hash, COALESCE(name, ''), role, created_at, updated_at`, email, passwordHash, nameValue, role)

	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}
