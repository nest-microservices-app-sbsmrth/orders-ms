pipeline {
    agent any
    environment {
        DOCKER_HUB_CREDENTIALS_ID = 'dockerhub-access'
        DOCKER_HUB_REPO = 'sbsmrth/products-app-orders-ms'
        ORDERS_MS_DB_URL = 'orders-ms-db-url'
    }
    stages {
        stage('Docker Build') {
            steps {
                script {
                    dockerImage = docker.build(
                        "${DOCKER_HUB_REPO}:latest", 
                        "--build-arg DATABASE_URL_ARG=${ORDERS_MS_DB_URL} -f Dockerfile.prod ."
                    )
                }
            }
        }
        stage('Docker Push') {
            steps {
                script {
                    docker.withRegistry("https://registry.hub.docker.com", "${DOCKER_HUB_CREDENTIALS_ID}") {
                        dockerImage.push("latest")
                    }
                }
            }
        }
    }
    post {
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}