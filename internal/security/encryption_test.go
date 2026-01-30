package security

import (
	"bytes"
	"crypto/rand"
	"testing"
)

func TestEncryptorRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatalf("read key: %v", err)
	}
	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("new encryptor: %v", err)
	}

	plain := []byte("snmp-secret-payload")
	ciphertext, err := enc.Encrypt(plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if bytes.Equal(ciphertext, plain) {
		t.Fatalf("ciphertext should differ from plaintext")
	}

	out, err := enc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(out, plain) {
		t.Fatalf("plaintext mismatch")
	}
}
