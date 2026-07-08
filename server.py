import http.server
import socketserver
import json
import os
import re

PORT = 8000
DIRECTORY = "."

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # API endpoints (ignora query parameters para roteamento)
        path = self.path.split('?')[0]
        if path == '/api/menu':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            if os.path.exists('cardapio.json'):
                with open('cardapio.json', 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(json.dumps([]).encode('utf-8'))
        elif path == '/api/images':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            images = []
            # List JPEGs/PNGs in IMG/ folder
            if os.path.exists('IMG'):
                for f in os.listdir('IMG'):
                    if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                        images.append(f"IMG/{f}")
            # Also list JPEGs/PNGs in root folder
            for f in os.listdir('.'):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and os.path.isfile(f):
                    images.append(f)
            self.wfile.write(json.dumps(images).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/api/menu':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('cardapio.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        elif path == '/api/upload':
            try:
                content_type = self.headers.get('Content-Type')
                if not content_type or 'multipart/form-data' not in content_type:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Invalid Content-Type")
                    return
                
                boundary = self.headers.get_boundary()
                if not boundary:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"No boundary found")
                    return
                
                content_length = int(self.headers['Content-Length'])
                body = self.rfile.read(content_length)
                
                boundary_bytes = ('--' + boundary).encode('utf-8')
                parts = body.split(boundary_bytes)
                
                uploaded_file_path = None
                for part in parts:
                    if b'filename="' in part:
                        header_end = part.find(b'\r\n\r\n')
                        if header_end != -1:
                            header = part[:header_end].decode('utf-8', errors='ignore')
                            content = part[header_end+4:]
                            
                            # Clean boundary padding
                            if content.endswith(b'\r\n'):
                                content = content[:-2]
                            elif content.endswith(b'--\r\n'):
                                content = content[:-4]
                            
                            if content.endswith(b'\r\n'):
                                content = content[:-2]
                            
                            fn_match = re.search(r'filename="([^"]+)"', header)
                            if fn_match:
                                filename = os.path.basename(fn_match.group(1))
                                if not os.path.exists('IMG'):
                                    os.makedirs('IMG')
                                save_path = os.path.join('IMG', filename)
                                with open(save_path, 'wb') as f:
                                    f.write(content)
                                uploaded_file_path = f"IMG/{filename}"
                                break
                
                if uploaded_file_path:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "filepath": uploaded_file_path}).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "No file parsed"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    import socketserver
    server_address = ('', PORT)
    class MyTCPServer(socketserver.TCPServer):
        allow_reuse_address = True
        
    try:
        with MyTCPServer(server_address, MyHTTPRequestHandler) as httpd:
            print(f"Servidor iniciado em http://localhost:{PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado.")
