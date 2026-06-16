-- Criação das Tabelas do Sistema Coletor

-- 1. Tabela de Empresas
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir uma empresa padrão para testes
INSERT INTO empresas (nome, logo_url) VALUES ('Casa 505', '') ON CONFLICT DO NOTHING;

-- 2. Tabela de Usuários
-- Perfis: 'ADM', 'GERADOR', 'CONFERENTE'
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL,
    empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP
);

-- Inserir um usuário ADM padrão (senha: admin123)
-- Nota: Em produção, as senhas devem ser hasheadas. Aqui usaremos texto plano temporariamente para facilidade de teste inicial, ou você pode hashear na API.
INSERT INTO usuarios (login, senha, perfil, empresa_id) VALUES ('admin', 'admin123', 'ADM', 1) ON CONFLICT (login) DO NOTHING;

-- 3. Tabela de Inventários
-- Status: 'PENDENTE', 'EM_ANDAMENTO', 'FINALIZADO'
CREATE TABLE IF NOT EXISTS inventarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
    gerador_id INTEGER REFERENCES usuarios(id),
    status VARCHAR(50) DEFAULT 'PENDENTE',
    data_importacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    inicio_contagem TIMESTAMP,
    fim_contagem TIMESTAMP
);

-- Migração: adiciona last_seen se tabela já existir
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;

-- 4. Tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventarios(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    unidade VARCHAR(20),
    ean VARCHAR(100),
    quantidade_esperada INTEGER DEFAULT 0,
    quantidade_coletada INTEGER DEFAULT 0,
    conferente_id INTEGER REFERENCES usuarios(id),
    data_coleta TIMESTAMP
);
