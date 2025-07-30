# Usa una imagen oficial de Node.js
FROM node:22

# Crea y define el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto al contenedor
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto de los archivos
COPY . .

# Expone el puerto (cámbialo si tu servidor usa otro)
EXPOSE 3000

# Comando para ejecutar el servidor
CMD ["node", "server.js"]
