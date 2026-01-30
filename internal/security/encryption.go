package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

const (
	keyLen = 32
)

// Encryptor wraps AES-GCM operations.
type Encryptor struct {
	gcm cipher.AEAD
}

// NewEncryptor returns an encryptor with a 32-byte key.
func NewEncryptor(key []byte) (*Encryptor, error) {
	if len(key) != keyLen {
		return nil, fmt.Errorf("encryption key must be %d bytes", keyLen)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Encryptor{gcm: gcm}, nil
}

// NewEncryptorFromEnv loads ENCRYPTION_KEY (raw or base64) and constructs an encryptor.
func NewEncryptorFromEnv() (*Encryptor, error) {
	raw := os.Getenv("ENCRYPTION_KEY")
	if raw == "" {
		return nil, errors.New("ENCRYPTION_KEY is not set")
	}
	key := []byte(raw)
	if len(key) != keyLen {
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return nil, errors.New("ENCRYPTION_KEY must be 32 bytes or base64-encoded")
		}
		key = decoded
	}
	return NewEncryptor(key)
}

// Encrypt returns nonce + ciphertext.
func (e *Encryptor) Encrypt(plaintext []byte) ([]byte, error) {
	if e == nil || e.gcm == nil {
		return nil, errors.New("encryptor not initialized")
	}
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	ciphertext := e.gcm.Seal(nil, nonce, plaintext, nil)
	out := make([]byte, 0, len(nonce)+len(ciphertext))
	out = append(out, nonce...)
	out = append(out, ciphertext...)
	return out, nil
}

// Decrypt expects nonce + ciphertext.
func (e *Encryptor) Decrypt(ciphertext []byte) ([]byte, error) {
	if e == nil || e.gcm == nil {
		return nil, errors.New("encryptor not initialized")
	}
	nonceSize := e.gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}
	nonce := ciphertext[:nonceSize]
	enc := ciphertext[nonceSize:]
	return e.gcm.Open(nil, nonce, enc, nil)
}
